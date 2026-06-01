import { Notice, requestUrl } from "obsidian";
import { InboxStateStore } from "./InboxState";
import { Highlight, PluginSettings, ReadwiseFetchResult } from "./types";

const READWISE_ENDPOINT = "https://readwise.io/api/v3/list/";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return "";
}

export class ReadwiseApi {
  constructor(private getSettings: () => PluginSettings, private stateStore: InboxStateStore) {}

  async fetchHighlights(): Promise<ReadwiseFetchResult> {
    const token = this.getSettings().readwiseToken.trim();
    if (!token) {
      throw new Error("Readwise API Token fehlt in den Plugin-Einstellungen.");
    }

    const state = this.stateStore.getState();
    const url = new URL(READWISE_ENDPOINT);
    url.searchParams.set("category", "highlight");
    if (state.last_readwise_cursor) {
      url.searchParams.set("pageCursor", state.last_readwise_cursor);
    } else {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      url.searchParams.set("updatedAfter", since);
    }

    const response = await requestUrl({
      url: url.toString(),
      method: "GET",
      headers: { Authorization: `Token ${token}` }
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Readwise Fetch fehlgeschlagen (${response.status}).`);
    }

    const data = response.json as Record<string, unknown>;
    const results = Array.isArray(data.results) ? data.results : [];
    const highlights = results.map((item) => this.mapReadwise(item)).filter(Boolean) as Highlight[];
    const counts = this.stateStore.upsertHighlights(highlights);
    const cursor = firstString(data.nextPageCursor, data.next_page_cursor, data.nextCursor) || null;
    this.stateStore.setCursor(cursor);
    await this.stateStore.save();

    new Notice(`Readwise geladen: ${counts.added} neu, ${counts.updated} aktualisiert.`);
    return { ...counts, cursor };
  }

  mapReadwise(raw: unknown): Highlight | null {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const item = raw as Record<string, unknown>;
    const id = firstString(item.id, item.highlight_id, item.readwise_id);
    if (!id) {
      return null;
    }
    const book = typeof item.book === "object" && item.book !== null ? item.book as Record<string, unknown> : {};
    const now = new Date().toISOString();
    return {
      id,
      readwise_id: id,
      text: firstString(item.text, item.highlight, item.content),
      note: firstString(item.note, item.notes),
      source_title: firstString(item.source_title, item.title, book.title, "Untitled"),
      source_author: firstString(item.source_author, item.author, book.author, "Unknown author"),
      source_url: firstString(item.source_url, item.url, book.source_url),
      source_cover: firstString(item.source_cover, item.cover_image_url, book.cover_image_url),
      highlighted_at: firstString(item.highlighted_at, item.created_at, item.updated_at),
      category: asString(item.category, "highlight"),
      readwise_url: firstString(item.readwise_url, item.url),
      status: "inbox",
      loadedAt: now,
      updatedAt: now
    };
  }
}
