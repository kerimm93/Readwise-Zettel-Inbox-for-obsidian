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

export function isWorkflowVisible(highlight: Pick<Highlight, "tags" | "workflow" | "status">): boolean {
  if (isRouteOpen(highlight, "atomic") || isRouteOpen(highlight, "reflect")) return true;
  if (highlight.tags.includes("make-anki")) return highlight.status === "inbox";
  // Preserve Sprint-1 untagged items. `nothing` is an explicit no-route decision.
  return highlight.tags.length === 0 && highlight.status === "inbox";
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
