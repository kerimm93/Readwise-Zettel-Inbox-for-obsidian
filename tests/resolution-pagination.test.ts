import assert from "node:assert/strict";
import { classifyReflectCandidates } from "../src/ReflectResolution.ts";
import { collectReadwiseExportPages, collectThenCommitReadwise } from "../src/ReadwisePagination.ts";
import { reconcileReflectStatus, reconcileResolvedReflectStatus, shouldUpdateReflectFilePath } from "../src/WorkflowRouting.ts";

const file = (path: string) => ({ path });
const cached = file("Cached.md");
const copy = file("Copy.md");
assert.equal(classifyReflectCandidates([{ file: cached, path: cached.path, reliable: false }], "123").kind, "unresolved");
assert.equal(reconcileReflectStatus("processed", false, false), "open");
for (const status of ["processed", "open", "skipped"] as const) {
  const resolution = classifyReflectCandidates([{ file: cached, path: cached.path, reliable: false }], "123");
  assert.equal(resolution.kind, "unresolved");
  assert.equal(reconcileResolvedReflectStatus(status, "unresolved"), status);
}
assert.equal(reconcileResolvedReflectStatus("processed", "found", true), "processed");
assert.equal(reconcileResolvedReflectStatus("processed", "found", false), "open");
assert.equal(reconcileResolvedReflectStatus("processed", "missing"), "open");
assert.deepEqual(classifyReflectCandidates([{ file: cached, path: cached.path, id: "123", reflected: true, reliable: true }], "123"), { kind: "found", file: cached, reflected: true });
assert.deepEqual(classifyReflectCandidates([{ file: cached, path: cached.path, id: "123", reflected: false, reliable: true }], "123"), { kind: "found", file: cached, reflected: false });
assert.equal(classifyReflectCandidates([{ file: cached, path: cached.path, reliable: true }], "123").kind, "missing");
assert.equal(reconcileReflectStatus("processed", false, false), "open");

assert.equal(classifyReflectCandidates([{ file: cached, path: cached.path, id: "123", reliable: true }], "123").kind, "found");
assert.equal(classifyReflectCandidates([
  { file: cached, path: cached.path, id: "123", reliable: true },
  { file: copy, path: copy.path, id: "123", reliable: true }
], "123").kind, "ambiguous");
assert.deepEqual(classifyReflectCandidates([
  { file: cached, path: cached.path, id: "old", reliable: true },
  { file: copy, path: copy.path, id: "123", reliable: true }
], "123"), { kind: "found", file: copy, reflected: false });
assert.equal(shouldUpdateReflectFilePath("Cached.md", "Copy.md"), true);
assert.equal(shouldUpdateReflectFilePath("Copy.md", "Copy.md"), false);

const page = (id: string, nextPageCursor: string | null, text = id) => ({ nextPageCursor, results: [{ title: "Book", highlights: [{ id, text }] }] });
let commits = 0;
let committedIds: string[] = [];
await collectThenCommitReadwise(async () => page("1", null), async (highlights) => { commits++; committedIds = highlights.map((item) => item.id); });
assert.equal(commits, 1);
assert.deepEqual(committedIds, ["1"]);

commits = 0;
const requested: Array<string | null> = [];
await collectThenCommitReadwise(async (cursor) => {
  requested.push(cursor);
  return cursor === null ? page("1", "A") : page("2", null);
}, async () => { commits++; });
assert.deepEqual(requested, [null, "A"]);
assert.equal(commits, 1);

for (const failure of [new Error("network"), new Error("HTTP 500")]) {
  commits = 0;
  await assert.rejects(collectThenCommitReadwise(async (cursor) => cursor === null ? page("1", "A") : Promise.reject(failure), async () => { commits++; }));
  assert.equal(commits, 0);
}

for (const pages of [
  (cursor: string | null) => cursor === null ? page("1", "A") : page("2", "A"),
  (cursor: string | null) => cursor === null ? page("1", "A") : cursor === "A" ? page("2", "B") : page("3", "A")
]) {
  commits = 0;
  await assert.rejects(collectThenCommitReadwise(async (cursor) => pages(cursor), async () => { commits++; }), /Cursor A erneut/);
  assert.equal(commits, 0);
}

const duplicate = await collectReadwiseExportPages(async (cursor) => cursor === null ? page("1", "A", "old") : page("1", null, "new"));
assert.equal(duplicate.length, 1);
assert.equal(duplicate[0].text, "new");
