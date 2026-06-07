import { Notice, requestUrl } from "obsidian";
import { InboxStateStore } from "./InboxState";
import { flattenReadwiseExport, getReadwiseCursor, READWISE_EXPORT_ENDPOINT } from "./ReadwiseMapping";
import { PluginSettings, ReadwiseFetchResult } from "./types";

export class ReadwiseApi {
  constructor(private getSettings: () => PluginSettings, private stateStore: InboxStateStore) {}

  async fetchHighlights(): Promise<ReadwiseFetchResult> {
    const token = this.getSettings().readwiseToken.trim();
    if (!token) {
      throw new Error("Readwise API Token fehlt in den Plugin-Einstellungen.");
    }

    const state = this.stateStore.getState();
    const url = new URL(READWISE_EXPORT_ENDPOINT);
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
    const highlights = flattenReadwiseExport(data);
    const counts = this.stateStore.upsertHighlights(highlights);
    const cursor = getReadwiseCursor(data);
    this.stateStore.setCursor(cursor);
    await this.stateStore.save();

    new Notice(`Readwise geladen: ${counts.added} neu, ${counts.updated} aktualisiert.`);
    return { ...counts, cursor };
  }
}
