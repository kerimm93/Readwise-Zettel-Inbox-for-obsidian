import assert from "node:assert/strict";
import { buildActiveStateReplacement } from "../src/StateCompaction.ts";
import type { Highlight, InboxState } from "../src/types.ts";

const h = (id: string, tags: string[], overrides: Partial<Highlight> = {}): Highlight => ({
  id,
  readwise_id: id,
  text: `text ${id}`,
  note: `note ${id}`,
  source_title: `title ${id}`,
  source_author: "author",
  source_url: "source",
  source_cover: "cover",
  highlighted_at: "highlighted",
  category: "books",
  readwise_url: "readwise",
  tags,
  workflow: { atomic: "open", reflect: "open", reflectFilePath: "" },
  status: "inbox",
  loadedAt: `loaded ${id}`,
  updatedAt: `updated ${id}`,
  ...overrides
});

const previous: InboxState = {
  highlights: [
    h("known", ["reflect"], { status: "processed", workflow: { atomic: "processed", reflect: "processed", reflectFilePath: "Reflect/known.md" }, loadedAt: "old-load", updatedAt: "old-local" }),
    h("removed", ["make-anki"]),
    h("reactivated", [])
  ],
  cards_pending: [{ id: "card", highlightId: "known", type: "mastery", createdAt: "then", payload: { safe: true } }],
  last_readwise_cursor: "old-cursor",
  updatedAt: "state-old",
  schemaVersion: 2
};

const exported = [
  h("untagged", []),
  h("nothing", ["nothing"]),
  h("theme", ["philosophy"]),
  h("known", ["reflect", "make-atomic"], { text: "fresh text", source_title: "fresh title", updatedAt: "readwise-new" }),
  h("reactivated", ["make-anki"], { text: "back" }),
  h("new", ["nothing", "make-atomic"]),
  h("new", ["nothing", "make-atomic"], { text: "dedup later wins" })
];

const result = buildActiveStateReplacement(previous, exported);
assert.deepEqual(result.state.highlights.map((item) => item.id), ["known", "reactivated", "new"]);
assert.equal(result.added, 1);
assert.equal(result.updated, 2);
assert.equal(result.removed, 1);
assert.equal(result.active, 3);
assert.deepEqual(result.state.cards_pending, previous.cards_pending);
assert.equal(result.state.last_readwise_cursor, null);

const known = result.state.highlights.find((item) => item.id === "known")!;
assert.equal(known.status, "processed");
assert.deepEqual(known.workflow, { atomic: "processed", reflect: "processed", reflectFilePath: "Reflect/known.md" });
assert.equal(known.loadedAt, "old-load");
assert.equal(known.text, "fresh text");
assert.equal(known.source_title, "fresh title");
assert.deepEqual(known.tags, ["reflect", "make-atomic"]);
assert.equal(known.updatedAt, "readwise-new");

assert.equal(result.state.highlights.find((item) => item.id === "reactivated")!.status, "inbox");
assert.equal(result.state.highlights.find((item) => item.id === "new")!.text, "dedup later wins");

const large = Array.from({ length: 20000 }, (_, index) => h(`inactive-${index}`, index % 2 ? [] : ["theme"]));
const largeResult = buildActiveStateReplacement(previous, [...large, h("small-active", ["reflect"])]);
assert.deepEqual(largeResult.state.highlights.map((item) => item.id), ["small-active"]);
assert.equal(largeResult.active, 1);
import { reconcileReflectHighlightsInMemory, prepareReflectCandidateReconciliation } from "../src/ReflectReconciliation.ts";
import { writeThenSwapState } from "../src/StateTransaction.ts";

const previousKnown = previous.highlights[0];
assert.notStrictEqual(known, previousKnown);
assert.notStrictEqual(known.workflow, previousKnown.workflow);
assert.notStrictEqual(known.tags, previousKnown.tags);
known.workflow.reflect = "open";
known.workflow.reflectFilePath = "Reflect/mutated.md";
known.tags.push("mutated");
assert.equal(previousKnown.workflow.reflect, "processed");
assert.equal(previousKnown.workflow.reflectFilePath, "Reflect/known.md");
assert.deepEqual(previousKnown.tags, ["reflect"]);

const reflectNotes = {
  async buildIndex() { return { candidatesByHighlightId: new Map([["known", [{ file: { path: "Reflect/found.md" }, path: "Reflect/found.md", id: "known", reflected: false, reliable: true }]]]), unreliableCandidates: [] }; },
  resolveFromIndex(index: { candidatesByHighlightId: Map<string, Array<{ file: { path: string }; path: string; id: string; reflected: boolean; reliable: boolean }>> }, id: string) {
    const candidate = index.candidatesByHighlightId.get(id)?.[0];
    return candidate ? { kind: "found" as const, file: candidate.file, reflected: candidate.reflected } : { kind: "missing" as const };
  }
};
const isolated = buildActiveStateReplacement(previous, [h("known", ["reflect"], { updatedAt: "readwise-time" })]);
const isolatedPrevious = previous.highlights[0];
const isolatedCandidate = isolated.state.highlights[0];
const changed = await reconcileReflectHighlightsInMemory(isolated.state.highlights, reflectNotes as never, new Set(), () => {}, () => "local-now");
assert.equal(changed, 2);
assert.equal(isolatedCandidate.workflow.reflect, "open");
assert.equal(isolatedCandidate.workflow.reflectFilePath, "Reflect/found.md");
assert.equal(isolatedCandidate.updatedAt, "local-now");
assert.equal(isolatedPrevious.workflow.reflect, "processed");
assert.equal(isolatedPrevious.workflow.reflectFilePath, "Reflect/known.md");
assert.equal(isolatedPrevious.updatedAt, "old-local");

const noChange = buildActiveStateReplacement(previous, [h("known", ["reflect"], { updatedAt: "readwise-time", workflow: { atomic: "open", reflect: "open", reflectFilePath: "" } })]);
const noChangeCandidate = noChange.state.highlights[0];
noChangeCandidate.workflow.reflect = "open";
noChangeCandidate.workflow.reflectFilePath = "Reflect/found.md";
noChangeCandidate.updatedAt = "before-reconcile";
const unchanged = await reconcileReflectHighlightsInMemory(noChange.state.highlights, reflectNotes as never, new Set(), () => {}, () => "should-not-appear");
assert.equal(unchanged, 0);
assert.equal(noChangeCandidate.updatedAt, "before-reconcile");

const visibleConfirmed = new Set(["old-confirmed"]);
const afterCommit = await prepareReflectCandidateReconciliation(isolated.state.highlights, reflectNotes as never, visibleConfirmed, () => {}, () => "later");
assert.deepEqual([...visibleConfirmed], ["old-confirmed"]);
afterCommit();
assert.deepEqual([...visibleConfirmed], ["known"]);

const failingConfirmed = new Set(["old-confirmed"]);
const failingReflectNotes = { ...reflectNotes, async buildIndex() { throw new Error("index failed"); } };
await assert.rejects(prepareReflectCandidateReconciliation(isolated.state.highlights, failingReflectNotes as never, failingConfirmed));
assert.deepEqual([...failingConfirmed], ["old-confirmed"]);

const originalSnapshot = JSON.stringify(previous);
let writes = 0;
await assert.rejects(writeThenSwapState(previous, isolated.state, async () => { writes++; throw new Error("write failed"); }), /write failed/);
assert.equal(writes, 1);
assert.equal(JSON.stringify(previous), originalSnapshot);

let successfulWrites = 0;
const committed = await writeThenSwapState(previous, isolated.state, async () => { successfulWrites++; });
assert.equal(successfulWrites, 1);
assert.strictEqual(committed, isolated.state);
