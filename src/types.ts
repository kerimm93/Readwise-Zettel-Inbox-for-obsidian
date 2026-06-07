export type HighlightStatus = "inbox" | "processed" | "skipped";

export interface Highlight {
  id: string;
  readwise_id: string;
  text: string;
  note: string;
  source_title: string;
  source_author: string;
  source_url: string;
  source_cover: string;
  highlighted_at: string;
  category: string;
  readwise_url: string;
  status: HighlightStatus;
  loadedAt: string;
  updatedAt: string;
}

export interface CardPending {
  id: string;
  highlightId: string;
  type: "mastery" | "memrise";
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface InboxState {
  highlights: Highlight[];
  cards_pending: CardPending[];
  last_readwise_cursor: string | null;
  updatedAt: string;
  schemaVersion: number;
}

export interface PluginSettings {
  readwiseToken: string;
  masteryDeck: string;
  memriseDeck: string;
  statePath: string;
  zettelFolder: string;
}

export interface ReadwiseFetchResult {
  added: number;
  updated: number;
  cursor: string | null;
}
