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

    // A complete paginated export is deliberately tied to the manual button.
    // It reconciles tags on old highlights even when Readwise does not change a
    // document's `updated` value after a highlight-tag edit.
    let cursor: string | null = null;
    const seen = new Set<string>();
    let added = 0;
    let updated = 0;
    do {
      const url = new URL(READWISE_EXPORT_ENDPOINT);
      if (cursor) url.searchParams.set("pageCursor", cursor);
      const response = await requestUrl({ url: url.toString(), method: "GET", headers: { Authorization: `Token ${token}` } });
      if (response.status < 200 || response.status >= 300) throw new Error(`Readwise Fetch fehlgeschlagen (${response.status}).`);
      const data = response.json as Record<string, unknown>;
      const unique = flattenReadwiseExport(data).filter((highlight) => {
        if (seen.has(highlight.id)) return false;
        seen.add(highlight.id);
        return true;
      });
      const counts = this.stateStore.upsertHighlights(unique);
      added += counts.added;
      updated += counts.updated;
      const next = getReadwiseCursor(data);
      if (next && next === cursor) throw new Error("Readwise lieferte denselben Cursor erneut; Fetch abgebrochen.");
      cursor = next;
    } while (cursor);
    this.stateStore.setCursor(null);
    await this.stateStore.save();

    new Notice(`Readwise geladen: ${added} neu, ${updated} aktualisiert.`);
    return { added, updated, cursor: null };
  }
}
