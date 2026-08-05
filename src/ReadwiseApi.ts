import { Notice, requestUrl } from "obsidian";
import { InboxStateStore } from "./InboxState";
import { READWISE_EXPORT_ENDPOINT } from "./ReadwiseMapping";
import { collectReadwiseExportPages } from "./ReadwisePagination";
import { buildActiveStateReplacement } from "./StateCompaction";
import { InboxState, PluginSettings, ReadwiseFetchResult } from "./types";

export class ReadwiseApi {
  constructor(private getSettings: () => PluginSettings, private stateStore: InboxStateStore) {}

  async fetchHighlights(reconcileCandidate?: (state: InboxState) => Promise<void>): Promise<ReadwiseFetchResult> {
    const token = this.getSettings().readwiseToken.trim();
    if (!token) {
      throw new Error("Readwise API Token fehlt in den Plugin-Einstellungen.");
    }

    // A complete paginated export is deliberately tied to the manual button.
    // It reconciles tags on old highlights even when Readwise does not change a
    // document's `updated` value after a highlight-tag edit.
    const highlights = await collectReadwiseExportPages(async (cursor) => {
      const url = new URL(READWISE_EXPORT_ENDPOINT);
      if (cursor) url.searchParams.set("pageCursor", cursor);
      const response = await requestUrl({ url: url.toString(), method: "GET", headers: { Authorization: `Token ${token}` } });
      if (response.status < 200 || response.status >= 300) throw new Error(`Readwise Fetch fehlgeschlagen (${response.status}).`);
      return response.json as Record<string, unknown>;
    });

    const replacement = buildActiveStateReplacement(this.stateStore.getState(), highlights);
    if (reconcileCandidate) await reconcileCandidate(replacement.state);
    await this.stateStore.replaceStateOnce(replacement.state);

    new Notice(`Readwise geladen: ${replacement.added} neu/neu aktiv, ${replacement.updated} aktualisiert, ${replacement.removed} entfernt/nicht übernommen, ${replacement.active} aktiv.`);
    return { added: replacement.added, updated: replacement.updated, removed: replacement.removed, active: replacement.active, cursor: null };
  }
}
