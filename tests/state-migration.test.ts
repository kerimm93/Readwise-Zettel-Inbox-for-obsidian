import assert from "node:assert/strict";
import { mergeFetchedHighlight } from "../src/HighlightMerge.ts";
import { normalizeSourceSchemaVersion, normalizeWorkflowForState } from "../src/StateMigration.ts";
import { isWorkflowVisible } from "../src/WorkflowRouting.ts";
import type { Highlight } from "../src/types.ts";

assert.equal(normalizeSourceSchemaVersion(1), 1);
assert.equal(normalizeSourceSchemaVersion(undefined), 1);
assert.equal(normalizeSourceSchemaVersion("2"), 1);
assert.equal(normalizeSourceSchemaVersion(2), 2);

const skipped = { atomic: "skipped", reflect: "skipped", reflectFilePath: "" } as const;
assert.deepEqual(normalizeWorkflowForState(undefined, "skipped", 1), skipped);
assert.deepEqual(normalizeWorkflowForState(undefined, "skipped", normalizeSourceSchemaVersion(undefined)), skipped);
assert.deepEqual(normalizeWorkflowForState(undefined, "processed", 1), { atomic: "open", reflect: "open", reflectFilePath: "" });
assert.deepEqual(normalizeWorkflowForState(undefined, "inbox", 1), { atomic: "open", reflect: "open", reflectFilePath: "" });

const explicit = { atomic: "processed", reflect: "open", reflectFilePath: "Reflect/note.md" } as const;
assert.deepEqual(normalizeWorkflowForState(explicit, "skipped", 1), explicit);
assert.deepEqual(normalizeWorkflowForState(explicit, "skipped", 2), explicit);
assert.equal(normalizeWorkflowForState({ reflect: "skipped" }, "processed", 2).reflect, "skipped");
assert.deepEqual(normalizeWorkflowForState(undefined, "skipped", 2), { atomic: "open", reflect: "open", reflectFilePath: "" });

const base: Highlight = {
  id: "legacy", readwise_id: "legacy", text: "", note: "", source_title: "Title", source_author: "", source_url: "", source_cover: "",
  highlighted_at: "", category: "highlight", readwise_url: "", tags: [], workflow: { ...skipped }, status: "skipped", loadedAt: "old", updatedAt: "old"
};
for (const tags of [["make-atomic"], ["reflect"], ["make-atomic", "reflect"], ["make-anki"], ["nothing", "reflect"]]) {
  const fetched: Highlight = { ...base, tags, workflow: { atomic: "open", reflect: "open", reflectFilePath: "" }, status: "inbox", updatedAt: "new" };
  const merged = mergeFetchedHighlight(base, fetched);
  assert.deepEqual(merged.tags, tags);
  assert.equal(merged.status, "skipped");
  assert.deepEqual(merged.workflow, skipped);
  assert.equal(isWorkflowVisible(merged), false);
}

const legitimateV2: Highlight = { ...base, tags: ["reflect"], workflow: { atomic: "open", reflect: "open", reflectFilePath: "" } };
assert.equal(isWorkflowVisible(legitimateV2), true);
