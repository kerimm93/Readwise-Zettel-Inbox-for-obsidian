import assert from "node:assert/strict";
import { buildReflectMarkdown, reflectFilename } from "../src/ReflectMarkdown.ts";
import { hasRoute, isWorkflowVisible, normalizeTags, normalizeWorkflow, withWorkflowStatus } from "../src/WorkflowRouting.ts";
import type { Highlight } from "../src/types.ts";

const base: Highlight = { id: "hi:123", readwise_id: "hi:123", text: "line one\nline two", note: "My Readwise note", source_title: "A: bad / title", source_author: "Ada: Author", source_url: "", source_cover: "", highlighted_at: "", category: "books", readwise_url: "", tags: [], workflow: { atomic: "open", reflect: "open", reflectFilePath: "" }, status: "processed", loadedAt: "x", updatedAt: "x" };

assert.deepEqual(normalizeTags([" Reflect ", { name: "MAKE-ATOMIC" }, { name: "reflect" }, { title: "ignored" }]), ["reflect", "make-atomic"]);
for (const [tags, atomic, reflect] of [
  [["make-atomic"], true, false], [["reflect"], false, true], [["make-atomic", "reflect"], true, true],
  [["nothing"], false, false], [["nothing", "reflect"], false, true], [["nothing", "make-atomic"], true, false]
] as const) {
  const item = { ...base, tags: [...tags] };
  assert.equal(hasRoute(item, "atomic"), atomic);
  assert.equal(hasRoute(item, "reflect"), reflect);
}

assert.deepEqual(normalizeWorkflow(undefined), { atomic: "open", reflect: "open", reflectFilePath: "" });
assert.deepEqual(normalizeWorkflow({ atomic: "processed", reflect: "skipped", reflectFilePath: "x.md" }), { atomic: "processed", reflect: "skipped", reflectFilePath: "x.md" });
const both = { ...base, tags: ["make-atomic", "reflect"] };
assert.equal(withWorkflowStatus(both, "atomic", "processed").workflow.reflect, "open");
assert.equal(withWorkflowStatus(both, "reflect", "processed").workflow.atomic, "open");
assert.equal(withWorkflowStatus(both, "reflect", "skipped").workflow.atomic, "open");
assert.equal(isWorkflowVisible({ ...both, status: "processed" }), true);
assert.equal(isWorkflowVisible({ ...both, status: "skipped" }), true);
assert.equal(isWorkflowVisible({ ...base, tags: ["make-anki"], status: "inbox" }), true);
assert.equal(isWorkflowVisible({ ...base, tags: ["nothing"], status: "inbox" }), false);
assert.equal(isWorkflowVisible({ ...base, tags: [], status: "inbox" }), true);

const filename = reflectFilename(base);
assert.match(filename, /hi-123/);
assert.match(filename, /A- bad - title/);
const markdown = buildReflectMarkdown(base, "2026-08-03T00:00:00.000Z");
for (const field of ["type: readwise-reflection", "workflow: reflect", "reflected: false", "readwise_highlight_id: \"hi:123\"", "created_at: \"2026-08-03T00:00:00.000Z\""]) assert.ok(markdown.includes(field));
assert.ok(markdown.includes("> line one\n> line two"));
assert.ok(markdown.indexOf("## Readwise-Notiz") < markdown.indexOf("## Gedanken und Reflexion"));
assert.ok(!markdown.includes("]()"));
