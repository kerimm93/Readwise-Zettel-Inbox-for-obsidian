import type { Highlight } from "./types";

export const READWISE_EXPORT_ENDPOINT = "https://readwise.io/api/v2/export/";

function stringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return fallback;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = stringValue(value);
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return "";
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function getReadwiseCursor(data: Record<string, unknown>): string | null {
  return firstString(data.nextPageCursor, data.next_page_cursor, data.nextCursor) || null;
}

export function flattenReadwiseExport(data: Record<string, unknown>, loadedAt = new Date().toISOString()): Highlight[] {
  const results = Array.isArray(data.results) ? data.results : [];
  const mapped: Highlight[] = [];

  for (const rawBook of results) {
    const book = objectValue(rawBook);
    const highlights = Array.isArray(book.highlights) ? book.highlights : [];
    for (const rawHighlight of highlights) {
      const highlight = mapReadwiseExportHighlight(book, objectValue(rawHighlight), loadedAt);
      if (highlight) {
        mapped.push(highlight);
      }
    }
  }

  return mapped;
}

export function mapReadwiseExportHighlight(book: Record<string, unknown>, item: Record<string, unknown>, loadedAt = new Date().toISOString()): Highlight | null {
  const id = firstString(item.id, item.highlight_id, item.readwise_id);
  if (!id) {
    return null;
  }

  return {
    id,
    readwise_id: id,
    text: firstString(item.text, item.highlight, item.content),
    note: firstString(item.note, item.notes),
    source_title: firstString(item.source_title, item.title, book.title, "Untitled"),
    source_author: firstString(item.source_author, item.author, book.author, "Unknown author"),
    source_url: firstString(item.source_url, item.url, book.source_url),
    source_cover: firstString(item.source_cover, item.cover_image_url, item.image_url, book.cover_image_url, book.image_url),
    highlighted_at: firstString(item.highlighted_at, item.created_at, item.updated_at),
    category: firstString(item.category, book.category, "highlight"),
    readwise_url: firstString(item.readwise_url, book.readwise_url, item.url),
    status: "inbox",
    loadedAt,
    updatedAt: loadedAt
  };
}
