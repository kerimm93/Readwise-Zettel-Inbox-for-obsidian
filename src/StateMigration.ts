import type { HighlightStatus, WorkflowState } from "./types.ts";
import { normalizeWorkflow } from "./WorkflowRouting.ts";

export function normalizeSourceSchemaVersion(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 1 ? value : 1;
}

export function normalizeWorkflowForState(rawWorkflow: unknown, globalStatus: HighlightStatus, sourceSchemaVersion: number): WorkflowState {
  const hasExplicitWorkflow = rawWorkflow !== null && typeof rawWorkflow === "object" && !Array.isArray(rawWorkflow);
  if (hasExplicitWorkflow) return normalizeWorkflow(rawWorkflow);
  if (sourceSchemaVersion === 1 && globalStatus === "skipped") {
    return { atomic: "skipped", reflect: "skipped", reflectFilePath: "" };
  }
  return normalizeWorkflow(undefined);
}
