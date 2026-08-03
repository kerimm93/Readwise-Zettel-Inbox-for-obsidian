import assert from "node:assert/strict";
import { buildReflectMarkdown, MAX_FILENAME_BYTES, reflectFilename, truncateUtf8, utf8ByteLength } from "../src/ReflectMarkdown.ts";
import { hasRoute, isMasteryAvailable, isReflectManageable, isWorkflowVisible, normalizeTags, normalizeWorkflow, reconcileReflectStatus, reflectActionState, shouldUpdateReflectFilePath, shouldUpdateWorkflowStatus, withWorkflowStatus } from "../src/WorkflowRouting.ts";
import { completeAtomicWorkflow } from "../src/WorkflowActions.ts";
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

for (const [tags, status, expected] of [
  [[], "inbox", true], [[], "processed", false], [["make-anki"], "inbox", true],
  [["make-anki"], "processed", false], [["make-atomic"], "inbox", false],
  [["reflect"], "inbox", false], [["make-atomic", "make-anki"], "inbox", true],
  [["make-atomic", "make-anki"], "processed", false], [["nothing", "make-anki"], "inbox", true],
  [["nothing"], "inbox", false]
] as const) assert.equal(isMasteryAvailable({ tags: [...tags], status }), expected);

const atomicAndAnki = { ...base, tags: ["make-atomic", "make-anki"], status: "inbox" as const };
const atomicCompleted = withWorkflowStatus(atomicAndAnki, "atomic", "processed");
assert.equal(atomicCompleted.workflow.atomic, "processed");
assert.equal(atomicCompleted.workflow.reflect, "open");
assert.equal(atomicCompleted.status, "inbox");
assert.equal(isMasteryAvailable(atomicCompleted), true);
assert.equal(isWorkflowVisible(atomicCompleted), true);
const writes: Array<[string, string, string]> = [];
await completeAtomicWorkflow({
  async setWorkflowStatus(id, route, status) { writes.push([id, route, status]); return true; }
}, atomicAndAnki.id);
assert.deepEqual(writes, [[atomicAndAnki.id, "atomic", "processed"]]);

for (const [current, fileExists, reflected, expected] of [
  ["skipped", true, true, "skipped"], ["skipped", true, false, "skipped"],
  ["skipped", false, false, "skipped"], ["open", true, true, "processed"],
  ["processed", true, false, "open"], ["processed", false, false, "open"]
] as const) assert.equal(reconcileReflectStatus(current, fileExists, reflected), expected);

const visibility = (tags: string[], atomic: "open" | "processed" | "skipped", reflect: "open" | "processed" | "skipped", status: "inbox" | "processed" | "skipped" = "processed") =>
  ({ ...base, tags, status, workflow: { atomic, reflect, reflectFilePath: "" } });
for (const [item, expected] of [
  [visibility(["reflect"], "processed", "open"), true],
  [visibility(["reflect"], "processed", "processed"), true],
  [visibility(["reflect"], "processed", "skipped"), false],
  [visibility(["reflect"], "processed", "processed", "processed"), true],
  [visibility(["reflect"], "processed", "processed", "skipped"), true],
  [visibility(["make-atomic"], "processed", "open"), false],
  [visibility(["make-atomic", "reflect"], "processed", "processed"), true],
  [visibility(["nothing", "reflect"], "processed", "processed"), true],
  [visibility(["make-atomic"], "processed", "processed"), false]
] as const) assert.equal(isWorkflowVisible(item), expected);
const processedReflect = visibility(["reflect"], "processed", "processed");
assert.equal(isReflectManageable(processedReflect), true);
assert.deepEqual(reflectActionState(processedReflect), { canOpen: true, canReset: true, canMark: false, canSkip: false });
const resetReflect = withWorkflowStatus(processedReflect, "reflect", "open");
assert.equal(isWorkflowVisible(resetReflect), true);
assert.deepEqual(reflectActionState(resetReflect), { canOpen: true, canReset: false, canMark: true, canSkip: true });
assert.equal(isReflectManageable(visibility(["reflect"], "processed", "skipped")), false);

assert.equal(shouldUpdateReflectFilePath("Reflect/note.md", "Reflect/note.md"), false);
assert.equal(shouldUpdateReflectFilePath("", "Reflect/note.md"), true);
assert.equal(shouldUpdateReflectFilePath("Old/note.md", "Reflect/note.md"), true);
const recoveredPath = "Reflect/note.md";
assert.equal(shouldUpdateReflectFilePath(recoveredPath, "Reflect/note.md"), false);
assert.equal(reconcileReflectStatus("skipped", true, false), "skipped");
assert.equal(shouldUpdateReflectFilePath("Reflect/note.md", "Reflect/note.md"), false);
assert.equal(shouldUpdateReflectFilePath("Old/note.md", "Reflect/note.md"), true);
assert.equal(shouldUpdateWorkflowStatus("open", "open"), false);
assert.equal(shouldUpdateWorkflowStatus("open", "processed"), true);

const filename = reflectFilename(base);
assert.match(filename, /hi-123/);
assert.match(filename, /A- bad - title/);
const markdown = buildReflectMarkdown(base, "2026-08-03T00:00:00.000Z");
for (const field of ["type: readwise-reflection", "workflow: reflect", "reflected: false", "readwise_highlight_id: \"hi:123\"", "created_at: \"2026-08-03T00:00:00.000Z\""]) assert.ok(markdown.includes(field));
assert.ok(markdown.includes("> line one\n> line two"));
assert.ok(markdown.indexOf("## Readwise-Notiz") < markdown.indexOf("## Gedanken und Reflexion"));
assert.ok(!markdown.includes("]()"));

const filenames = [
  reflectFilename({ id: "123", source_title: "Short title" }),
  reflectFilename({ id: "123", source_title: "a".repeat(500) }),
  reflectFilename({ id: "123", source_title: "漢".repeat(120) }),
  reflectFilename({ id: "123", source_title: "😀".repeat(120) }),
  reflectFilename({ id: "123", source_title: "ASCII 漢字 😀 mixed ".repeat(40) }),
  reflectFilename({ id: "id:123", source_title: "bad/title?name" }),
  reflectFilename({ id: "123", source_title: "" })
];
assert.equal(filenames[0], "Reflect – 123 – Short title.md");
for (const filename of filenames) {
  assert.ok(utf8ByteLength(filename) <= MAX_FILENAME_BYTES);
  assert.ok(filename.includes("123"));
  assert.ok(filename.endsWith(".md"));
  assert.equal(filename.includes("\uFFFD"), false);
}
assert.equal(filenames[5].includes(":"), false);
assert.ok(filenames[6].includes("Ohne Titel"));
assert.equal(reflectFilename({ id: "123", source_title: "😀".repeat(120) }), filenames[3]);
assert.equal(truncateUtf8("😀😀", 4), "😀");
assert.throws(() => reflectFilename({ id: "x".repeat(250), source_title: "title" }), /ID ist zu lang/);
