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
