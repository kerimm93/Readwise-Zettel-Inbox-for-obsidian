import { Notice, requestUrl } from "obsidian";
import { InboxStateStore } from "./InboxState";
import { READWISE_EXPORT_ENDPOINT } from "./ReadwiseMapping";
import { collectThenCommitReadwise } from "./ReadwisePagination";
import { PluginSettings, ReadwiseFetchResult } from "./types";

export class ReadwiseApi {
  constructor(private getSettings: () => PluginSettings, private stateStore: InboxStateStore) {}

  async fetchHighlights(): Promise<ReadwiseFetchResult> {
    const token = this.getSettings().readwiseToken.trim();
    if (!token) {
      throw new Error("Readwise API Token fehlt in den Plugin-Einstellungen.");
    }

    // A complete paginated export is deliberately tied to the manual button.
    // It reconciles tags on old highlights even when Readwise does not change a
    // document's `updated` value after a highlight-tag edit.
    const counts = await collectThenCommitReadwise(async (cursor) => {
      const url = new URL(READWISE_EXPORT_ENDPOINT);
      if (cursor) url.searchParams.set("pageCursor", cursor);
      const response = await requestUrl({ url: url.toString(), method: "GET", headers: { Authorization: `Token ${token}` } });
      if (response.status < 200 || response.status >= 300) throw new Error(`Readwise Fetch fehlgeschlagen (${response.status}).`);
      return response.json as Record<string, unknown>;
    }, async (highlights) => {
      const result = this.stateStore.upsertHighlights(highlights);
      this.stateStore.setCursor(null);
      await this.stateStore.save();
      return result;
    });

    new Notice(`Readwise geladen: ${counts.added} neu, ${counts.updated} aktualisiert.`);
    return { ...counts, cursor: null };
  }
}
