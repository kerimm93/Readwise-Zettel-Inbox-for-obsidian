import { normalizePath } from "obsidian";
import type { Highlight } from "./types.ts";
import { hasRoute, isConfirmedReflectResolution, reconcileReflectStatus, recordConfirmedReflectFile, shouldUpdateReflectFilePath } from "./WorkflowRouting.ts";
import { buildReflectIndexIfNeeded } from "./ReflectResolution.ts";
import type { ReflectNoteService } from "./ReflectNoteService.ts";
import { isActiveWorkflowHighlight } from "./ActiveWorkflow.ts";

export async function reconcileReflectHighlightsInMemory(highlights: Highlight[], reflectNotes: ReflectNoteService, confirmed: Set<string>, notify: (message: string) => void = () => {}): Promise<number> {
  confirmed.clear();
  const reflectHighlights = highlights.filter((item) => isActiveWorkflowHighlight(item) && hasRoute(item, "reflect"));
  const reflectIndex = await buildReflectIndexIfNeeded(reflectHighlights.map((highlight) => highlight.id), () => reflectNotes.buildIndex());
  let reconciled = 0;
  for (const highlight of reflectHighlights) {
    try {
      const resolution = reflectNotes.resolveFromIndex(reflectIndex!, highlight.id);
      if (isConfirmedReflectResolution(resolution.kind)) recordConfirmedReflectFile(confirmed, highlight.id);
      if (resolution.kind === "ambiguous") { notify(`Mehrere Reflect-Dateien für Highlight ${highlight.id} gefunden.`); continue; }
      if (resolution.kind === "unresolved") continue;
      const file = resolution.kind === "found" ? resolution.file : null;
      const reconciledStatus = reconcileReflectStatus(highlight.workflow.reflect, resolution.kind === "found", resolution.kind === "found" && resolution.reflected);
      if (file) {
        const currentPath = normalizePath(highlight.workflow.reflectFilePath || "");
        const resolvedPath = normalizePath(file.path);
        if (shouldUpdateReflectFilePath(currentPath, resolvedPath)) { highlight.workflow.reflectFilePath = resolvedPath; reconciled += 1; }
      }
      if (reconciledStatus !== highlight.workflow.reflect) { highlight.workflow.reflect = reconciledStatus; reconciled += 1; }
    } catch (error) { notify(error instanceof Error ? error.message : "Reflect-Status konnte nicht abgeglichen werden."); }
  }
  return reconciled;
}
