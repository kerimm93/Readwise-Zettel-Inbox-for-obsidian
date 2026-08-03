import assert from "node:assert/strict";
import { flattenReadwiseExport, getReadwiseCursor, READWISE_EXPORT_ENDPOINT } from "../src/ReadwiseMapping.ts";

const loadedAt = "2026-06-01T00:00:00.000Z";
const fixture = {
  nextPageCursor: "cursor-2",
  results: [
    {
      title: "A Full Book Title",
      author: "Ada Author",
      source_url: "https://publisher.example/book",
      cover_image_url: "https://images.example/cover.jpg",
      category: "books",
      readwise_url: "https://readwise.io/bookreview/123",
      highlights: [
        {
          id: 987654321,
          text: "A useful highlighted sentence.",
          note: "Remember this",
          highlighted_at: "2026-05-31T12:00:00Z",
          image_url: "https://images.example/highlight.jpg"
          ,tags: [{ id: 11, name: " Reflect " }, { id: 12, name: "MAKE-ATOMIC" }, { id: 13, name: "reflect" }]
        }
      ]
    }
  ]
};

const highlights = flattenReadwiseExport(fixture, loadedAt);

assert.equal(READWISE_EXPORT_ENDPOINT, "https://readwise.io/api/v2/export/");
assert.equal(getReadwiseCursor(fixture), "cursor-2");
assert.equal(highlights.length, 1);
assert.deepEqual(highlights[0], {
  id: "987654321",
  readwise_id: "987654321",
  text: "A useful highlighted sentence.",
  note: "Remember this",
  source_title: "A Full Book Title",
  source_author: "Ada Author",
  source_url: "https://publisher.example/book",
  source_cover: "https://images.example/highlight.jpg",
  highlighted_at: "2026-05-31T12:00:00Z",
  category: "books",
  readwise_url: "https://readwise.io/bookreview/123",
  tags: ["reflect", "make-atomic"],
  workflow: { atomic: "open", reflect: "open", reflectFilePath: "" },
  status: "inbox",
  loadedAt,
  updatedAt: loadedAt
});
