import { App, normalizePath, TFile } from "obsidian";
import { Highlight, HighlightStatus, InboxState, PluginSettings, WorkflowStatus } from "./types";
import { isWorkflowVisible, normalizeTags, shouldUpdateReflectFilePath, shouldUpdateWorkflowStatus, WorkflowRoute } from "./WorkflowRouting";
import { normalizeSourceSchemaVersion, normalizeWorkflowForState } from "./StateMigration";
import { writeThenSwapState } from "./StateTransaction";

const CURRENT_SCHEMA_VERSION = 2;

export const DEFAULT_STATE: InboxState = {
  highlights: [],
  cards_pending: [],
  last_readwise_cursor: null,
  updatedAt: new Date(0).toISOString(),
  schemaVersion: CURRENT_SCHEMA_VERSION
};

function nowIso(): string {
  return new Date().toISOString();
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeStatus(value: unknown): HighlightStatus {
  if (value === "processed" || value === "skipped" || value === "inbox") {
    return value;
  }
  return "inbox";
}

export class InboxStateStore {
  private state: InboxState = { ...DEFAULT_STATE, highlights: [], cards_pending: [] };

  constructor(private app: App, private getSettings: () => PluginSettings) {}

  getState(): InboxState {
    return this.state;
  }

  getInboxHighlights(): Highlight[] {
    return this.state.highlights.filter((highlight) => isWorkflowVisible(highlight));
  }

  async load(): Promise<InboxState> {
    const path = this.getStatePath();
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      this.state = this.normalizeState(null);
      return this.state;
    }

    const raw = await this.app.vault.read(file);
    const parsed = raw.trim().length > 0 ? JSON.parse(raw) : null;
    this.state = this.normalizeState(parsed);
    return this.state;
  }

  async save(): Promise<void> {
    this.state.updatedAt = nowIso();
    await this.writeState(this.state);
  }

  async replaceStateOnce(nextState: InboxState): Promise<void> {
    const previous = this.state;
    const candidate = { ...nextState, updatedAt: nowIso(), schemaVersion: CURRENT_SCHEMA_VERSION };
    this.state = await writeThenSwapState(previous, candidate, (state) => this.writeState(state));
  }

  async setStatus(id: string, status: HighlightStatus): Promise<boolean> {
    const highlight = this.state.highlights.find((item) => item.id === id);
    if (!highlight) {
      return false;
    }

    if (highlight.status === status) {
      return true;
    }

    if ((highlight.status === "processed" || highlight.status === "skipped") && status === "inbox") {
      return true;
    }

    highlight.status = status;
    highlight.updatedAt = nowIso();
    await this.save();
    return true;
  }

  async setWorkflowStatus(id: string, route: WorkflowRoute, status: WorkflowStatus): Promise<boolean> {
    const highlight = this.state.highlights.find((item) => item.id === id);
    if (!highlight) return false;
    if (!shouldUpdateWorkflowStatus(highlight.workflow[route], status)) return true;
    highlight.workflow[route] = status;
    highlight.updatedAt = nowIso();
    await this.save();
    return true;
  }

  async setReflectFilePath(id: string, path: string): Promise<boolean> {
    const highlight = this.state.highlights.find((item) => item.id === id);
    if (!highlight) return false;
    const normalizedPath = normalizePath(path);
    if (!shouldUpdateReflectFilePath(normalizePath(highlight.workflow.reflectFilePath || ""), normalizedPath)) return true;
    highlight.workflow.reflectFilePath = normalizedPath;
    highlight.updatedAt = nowIso();
    await this.save();
    return true;
  }

  private async writeState(state: InboxState): Promise<void> {
    const path = this.getStatePath();
    await this.ensureParentFolder(path);
    const file = this.app.vault.getAbstractFileByPath(path);
    const serialized = `${JSON.stringify(state, null, 2)}\n`;
    if (file instanceof TFile) {
      await this.app.vault.modify(file, serialized);
    } else {
      await this.app.vault.create(path, serialized);
    }
  }

  private getStatePath(): string {
    return normalizePath(this.getSettings().statePath || "readwise-inbox.json");
  }

  private normalizeState(raw: unknown): InboxState {
    const source = raw && typeof raw === "object" ? (raw as Partial<InboxState>) : {};
    const sourceSchemaVersion = normalizeSourceSchemaVersion(source.schemaVersion);
    const highlights = Array.isArray(source.highlights) ? source.highlights.map((item) => this.normalizeHighlight(item, sourceSchemaVersion)).filter(Boolean) as Highlight[] : [];
    return {
      highlights,
      cards_pending: Array.isArray(source.cards_pending) ? source.cards_pending : [],
      last_readwise_cursor: typeof source.last_readwise_cursor === "string" ? source.last_readwise_cursor : null,
      updatedAt: asString(source.updatedAt, nowIso()),
      schemaVersion: CURRENT_SCHEMA_VERSION
    };
  }

  private normalizeHighlight(raw: unknown, sourceSchemaVersion: number): Highlight | null {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const item = raw as Partial<Highlight>;
    const readwiseId = asString(item.readwise_id || item.id);
    if (!readwiseId) {
      return null;
    }
    const loadedAt = asString(item.loadedAt, nowIso());
    const status = normalizeStatus(item.status);
    return {
      id: asString(item.id, readwiseId),
      readwise_id: readwiseId,
      text: asString(item.text),
      note: asString(item.note),
      source_title: asString(item.source_title, "Untitled"),
      source_author: asString(item.source_author, "Unknown author"),
      source_url: asString(item.source_url),
      source_cover: asString(item.source_cover),
      highlighted_at: asString(item.highlighted_at),
      category: asString(item.category, "highlight"),
      readwise_url: asString(item.readwise_url),
      tags: normalizeTags(item.tags),
      workflow: normalizeWorkflowForState(item.workflow, status, sourceSchemaVersion),
      status,
      loadedAt,
      updatedAt: asString(item.updatedAt, loadedAt)
    };
  }

  private async ensureParentFolder(path: string): Promise<void> {
    const parts = path.split("/");
    parts.pop();
    const folder = parts.join("/");
    if (!folder) {
      return;
    }
    let current = "";
    for (const part of folder.split("/").filter(Boolean)) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }
}
