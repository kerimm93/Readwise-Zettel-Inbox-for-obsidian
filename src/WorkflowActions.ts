import type { WorkflowStatus } from "./types.ts";

export interface WorkflowStatusWriter {
  setWorkflowStatus(id: string, route: "atomic" | "reflect", status: WorkflowStatus): Promise<boolean>;
}

export async function completeAtomicWorkflow(store: WorkflowStatusWriter, highlightId: string): Promise<boolean> {
  return store.setWorkflowStatus(highlightId, "atomic", "processed");
}

export async function fetchReconcileAndRender(fetch: () => Promise<unknown>, reconcile: () => Promise<void>, render: () => void): Promise<void> {
  await fetch();
  await reconcile();
  render();
}
