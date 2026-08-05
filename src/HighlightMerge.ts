import type { Highlight } from "./types";

/**
 * Merge a fresh Readwise representation into an existing local workflow item.
 * Readwise owns the content and source metadata; the inbox owns workflow state.
 */
export function mergeFetchedHighlight(existing: Highlight, next: Highlight): Highlight {
  return {
    ...existing,
    readwise_id: next.readwise_id,
    text: next.text,
    note: next.note,
    source_title: next.source_title,
    source_author: next.source_author,
    source_url: next.source_url,
    source_cover: next.source_cover,
    highlighted_at: next.highlighted_at,
    category: next.category,
    readwise_url: next.readwise_url,
    tags: [...next.tags],
    workflow: { ...existing.workflow },
    updatedAt: next.updatedAt,
    status: existing.status,
    loadedAt: existing.loadedAt
  };
}
