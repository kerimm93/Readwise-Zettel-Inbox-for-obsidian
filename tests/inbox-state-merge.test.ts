import assert from "node:assert/strict";
import { mergeFetchedHighlight } from "../src/HighlightMerge.ts";
import type { Highlight, HighlightStatus } from "../src/types.ts";

const originalLoadedAt = "2026-06-01T00:00:00.000Z";

function highlight(status: HighlightStatus): Highlight {
  return {
    id: "highlight-123",
    readwise_id: "old-readwise-id",
    text: "Old text",
    note: "Old note",
    source_title: "Old title",
    source_author: "Old author",
    source_url: "https://old.example/source",
    source_cover: "https://old.example/cover.jpg",
    highlighted_at: "2026-05-01T00:00:00.000Z",
    category: "old-category",
    readwise_url: "https://readwise.io/old",
    tags: ["make-atomic"],
    workflow: { atomic: "processed", reflect: "open", reflectFilePath: "Reflect/existing.md" },
    status,
    loadedAt: originalLoadedAt,
    updatedAt: originalLoadedAt
  };
}

const fetchedAt = "2026-07-01T00:00:00.000Z";
const next: Highlight = {
  ...highlight("inbox"),
  readwise_id: "highlight-123",
  text: "New text",
  note: "New note",
  source_title: "New title",
  source_author: "New author",
  source_url: "",
  source_cover: "",
  highlighted_at: "2026-06-30T00:00:00.000Z",
  category: "books",
  readwise_url: "https://readwise.io/new",
  tags: ["reflect"],
  loadedAt: fetchedAt,
  updatedAt: fetchedAt
};

const mergedInbox = mergeFetchedHighlight(highlight("inbox"), next);
assert.equal(mergedInbox.text, "New text");
assert.equal(mergedInbox.note, "New note");
assert.equal(mergedInbox.source_title, "New title");
assert.equal(mergedInbox.source_author, "New author");
assert.equal(mergedInbox.source_url, "");
assert.equal(mergedInbox.source_cover, "");
assert.equal(mergedInbox.highlighted_at, next.highlighted_at);
assert.equal(mergedInbox.category, "books");
assert.equal(mergedInbox.readwise_url, "https://readwise.io/new");
assert.equal(mergedInbox.readwise_id, "highlight-123");
assert.equal(mergedInbox.updatedAt, fetchedAt);
assert.equal(mergedInbox.status, "inbox");
assert.equal(mergedInbox.loadedAt, originalLoadedAt);
assert.deepEqual(mergedInbox.tags, ["reflect"]);
assert.deepEqual(mergedInbox.workflow, { atomic: "processed", reflect: "open", reflectFilePath: "Reflect/existing.md" });

for (const status of ["skipped", "processed"] as const) {
  const merged = mergeFetchedHighlight(highlight(status), next);
  assert.equal(merged.status, status);
  assert.equal(merged.loadedAt, originalLoadedAt);
  assert.equal(merged.text, "New text");
}
