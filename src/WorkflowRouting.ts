import type { Highlight, WorkflowStatus } from "./types.ts";

export type WorkflowRoute = "atomic" | "reflect";

export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const values = raw.map((entry) => {
    if (typeof entry === "string") return entry;
    if (entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).name === "string") {
      return (entry as Record<string, unknown>).name as string;
    }
    return "";
  }).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  return [...new Set(values)];
}

export function hasRoute(highlight: Pick<Highlight, "tags">, route: WorkflowRoute): boolean {
  return highlight.tags.includes(route === "atomic" ? "make-atomic" : "reflect");
}

export function isRouteOpen(highlight: Pick<Highlight, "tags" | "workflow">, route: WorkflowRoute): boolean {
  return hasRoute(highlight, route) && highlight.workflow[route] === "open";
}

export function isMasteryAvailable(highlight: Pick<Highlight, "tags" | "status">): boolean {
  if (highlight.status !== "inbox") return false;
  return highlight.tags.length === 0 || highlight.tags.includes("make-anki");
}

export function isReflectManageable(highlight: Pick<Highlight, "tags" | "workflow">): boolean {
  return hasRoute(highlight, "reflect") && highlight.workflow.reflect === "processed";
}

export function isWorkflowVisible(highlight: Pick<Highlight, "tags" | "workflow" | "status">): boolean {
  if (isRouteOpen(highlight, "atomic") || isRouteOpen(highlight, "reflect")) return true;
  return isReflectManageable(highlight) || isMasteryAvailable(highlight);
}

export interface ReflectActionState { canOpen: boolean; canReset: boolean; canMark: boolean; canSkip: boolean }

export function reflectActionState(highlight: Pick<Highlight, "tags" | "workflow">, hasConfirmedFile: boolean): ReflectActionState {
  const routed = hasRoute(highlight, "reflect");
  return {
    canOpen: routed && highlight.workflow.reflect !== "skipped",
    canReset: routed && highlight.workflow.reflect === "processed" && hasConfirmedFile,
    canMark: routed && highlight.workflow.reflect === "open" && hasConfirmedFile,
    canSkip: routed && highlight.workflow.reflect === "open"
  };
}

export function reflectButtonLabels(actions: ReflectActionState): string[] {
  const labels: string[] = [];
  if (actions.canOpen) labels.push("Reflect öffnen");
  if (actions.canMark) labels.push("Als reflektiert markieren");
  if (actions.canReset) labels.push("Reflexion zurücksetzen");
  if (actions.canSkip) labels.push("Reflect skip");
  return labels;
}

export function isConfirmedReflectResolution(kind: "found" | "missing" | "ambiguous" | "unresolved"): boolean {
  return kind === "found";
}

export function recordConfirmedReflectFile(confirmed: Set<string>, highlightId: string): void {
  confirmed.add(highlightId);
}

export function withWorkflowStatus(highlight: Highlight, route: WorkflowRoute, status: WorkflowStatus): Highlight {
  return { ...highlight, workflow: { ...highlight.workflow, [route]: status } };
}

export function normalizeWorkflow(raw: unknown): Highlight["workflow"] {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const status = (item: unknown): WorkflowStatus => item === "processed" || item === "skipped" || item === "open" ? item : "open";
  return {
    atomic: status(value.atomic),
    reflect: status(value.reflect),
    reflectFilePath: typeof value.reflectFilePath === "string" ? value.reflectFilePath : ""
  };
}

export function reconcileReflectStatus(currentStatus: WorkflowStatus, fileExists: boolean, reflected: boolean): WorkflowStatus {
  if (currentStatus === "skipped") return "skipped";
  if (!fileExists) return currentStatus === "processed" ? "open" : currentStatus;
  return reflected ? "processed" : "open";
}

export function reconcileResolvedReflectStatus(currentStatus: WorkflowStatus, kind: "found" | "missing" | "ambiguous" | "unresolved", reflected = false): WorkflowStatus {
  if (kind === "ambiguous" || kind === "unresolved") return currentStatus;
  return reconcileReflectStatus(currentStatus, kind === "found", reflected);
}

export function shouldUpdateReflectFilePath(currentPath: string, resolvedPath: string): boolean {
  return currentPath !== resolvedPath;
}

export function shouldUpdateWorkflowStatus(currentStatus: WorkflowStatus, nextStatus: WorkflowStatus): boolean {
  return currentStatus !== nextStatus;
}
