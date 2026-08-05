import type { Highlight } from "./types.ts";
import { hasRoute, isConfirmedReflectResolution, reconcileReflectStatus, recordConfirmedReflectFile, shouldUpdateReflectFilePath } from "./WorkflowRouting.ts";
import { buildReflectIndexIfNeeded } from "./ReflectResolution.ts";
import { isActiveWorkflowHighlight } from "./ActiveWorkflow.ts";

interface ReflectReconciliationNotes {
  buildIndex(): Promise<unknown>;
  resolveFromIndex(index: never, id: string): { kind: "found"; file: { path: string }; reflected: boolean } | { kind: "missing" | "ambiguous" | "unresolved" };
}

function normalizeLocalPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export async function reconcileReflectHighlightsInMemory(highlights: Highlight[], reflectNotes: ReflectReconciliationNotes, confirmed: Set<string>, notify: (message: string) => void = () => {}, now: () => string = () => new Date().toISOString(), errorMode: "best-effort" | "strict" = "best-effort"): Promise<number> {
  confirmed.clear();
  const reflectHighlights = highlights.filter((item) => isActiveWorkflowHighlight(item) && hasRoute(item, "reflect"));
  const reflectIndex = await buildReflectIndexIfNeeded(reflectHighlights.map((highlight) => highlight.id), () => reflectNotes.buildIndex() as never);
  let reconciled = 0;
  for (const highlight of reflectHighlights) {
    try {
      const resolution = reflectNotes.resolveFromIndex(reflectIndex as never, highlight.id);
      if (isConfirmedReflectResolution(resolution.kind)) recordConfirmedReflectFile(confirmed, highlight.id);
      if (resolution.kind === "ambiguous") { notify(`Mehrere Reflect-Dateien für Highlight ${highlight.id} gefunden.`); continue; }
      if (resolution.kind === "unresolved") continue;
      const file = resolution.kind === "found" ? resolution.file : null;
      const reconciledStatus = reconcileReflectStatus(highlight.workflow.reflect, resolution.kind === "found", resolution.kind === "found" && resolution.reflected);
      if (file) {
        const currentPath = normalizeLocalPath(highlight.workflow.reflectFilePath || "");
        const resolvedPath = normalizeLocalPath(file.path);
        if (shouldUpdateReflectFilePath(currentPath, resolvedPath)) { highlight.workflow.reflectFilePath = resolvedPath; highlight.updatedAt = now(); reconciled += 1; }
      }
      if (reconciledStatus !== highlight.workflow.reflect) { highlight.workflow.reflect = reconciledStatus; highlight.updatedAt = now(); reconciled += 1; }
    } catch (error) {
      if (errorMode === "strict") throw error;
      notify(error instanceof Error ? error.message : "Reflect-Status konnte nicht abgeglichen werden.");
    }
  }
  return reconciled;
}

export async function prepareReflectCandidateReconciliation(highlights: Highlight[], reflectNotes: ReflectReconciliationNotes, visibleConfirmed: Set<string>, notify: (message: string) => void = () => {}, now: () => string = () => new Date().toISOString()): Promise<() => void> {
  const nextConfirmed = new Set<string>();
  await reconcileReflectHighlightsInMemory(highlights, reflectNotes, nextConfirmed, notify, now, "strict");
  return () => {
    visibleConfirmed.clear();
    for (const id of nextConfirmed) visibleConfirmed.add(id);
  };
}
