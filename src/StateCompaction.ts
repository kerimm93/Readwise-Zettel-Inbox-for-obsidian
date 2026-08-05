import { mergeFetchedHighlight } from "./HighlightMerge.ts";
import type { Highlight, InboxState } from "./types.ts";
import { isActiveWorkflowHighlight } from "./ActiveWorkflow.ts";

export interface ActiveStateReplacementResult {
  state: InboxState;
  added: number;
  updated: number;
  removed: number;
  active: number;
}

export function buildActiveStateReplacement(previous: InboxState, exported: Highlight[]): ActiveStateReplacementResult {
  const previousById = new Map(previous.highlights.map((highlight) => [highlight.id, highlight]));
  const exportedById = new Map<string, Highlight>();
  for (const highlight of exported) exportedById.set(highlight.id, highlight);

  const nextHighlights: Highlight[] = [];
  let added = 0;
  let updated = 0;
  for (const next of exportedById.values()) {
    if (!isActiveWorkflowHighlight(next)) continue;
    const existing = previousById.get(next.id);
    if (existing) {
      nextHighlights.push(mergeFetchedHighlight(existing, next));
      updated += 1;
    } else {
      nextHighlights.push(next);
      added += 1;
    }
  }

  const nextIds = new Set(nextHighlights.map((highlight) => highlight.id));
  let removed = 0;
  for (const existing of previous.highlights) if (!nextIds.has(existing.id)) removed += 1;

  return {
    state: { ...previous, highlights: nextHighlights, last_readwise_cursor: null },
    added,
    updated,
    removed,
    active: nextHighlights.length
  };
}
