import { flattenReadwiseExport, getReadwiseCursor } from "./ReadwiseMapping.ts";
import type { Highlight } from "./types.ts";

export type ReadwisePageRequest = (cursor: string | null) => Promise<Record<string, unknown>>;

export async function collectReadwiseExportPages(requestPage: ReadwisePageRequest): Promise<Highlight[]> {
  let cursor: string | null = null;
  const seenCursors = new Set<string>();
  const byId = new Map<string, Highlight>();
  do {
    const data = await requestPage(cursor);
    // Later pages win when Readwise repeats an ID with a more complete representation.
    for (const highlight of flattenReadwiseExport(data)) byId.set(highlight.id, highlight);
    const next = getReadwiseCursor(data);
    if (next && seenCursors.has(next)) throw new Error(`Readwise lieferte den Cursor ${next} erneut; Fetch abgebrochen.`);
    if (next) seenCursors.add(next);
    cursor = next;
  } while (cursor);
  return [...byId.values()];
}

export async function collectThenCommitReadwise<T>(requestPage: ReadwisePageRequest, commit: (highlights: Highlight[]) => Promise<T>): Promise<T> {
  const highlights = await collectReadwiseExportPages(requestPage);
  return commit(highlights);
}
