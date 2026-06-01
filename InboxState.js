"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InboxStateStore = exports.DEFAULT_STATE = void 0;
const obsidian_1 = require("obsidian");
const CURRENT_SCHEMA_VERSION = 1;
exports.DEFAULT_STATE = {
    highlights: [],
    cards_pending: [],
    last_readwise_cursor: null,
    updatedAt: new Date(0).toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION
};
function nowIso() {
    return new Date().toISOString();
}
function asString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
}
function normalizeStatus(value) {
    if (value === "processed" || value === "skipped" || value === "inbox") {
        return value;
    }
    return "inbox";
}
class InboxStateStore {
    constructor(app, getSettings) {
        this.app = app;
        this.getSettings = getSettings;
        this.state = { ...exports.DEFAULT_STATE, highlights: [], cards_pending: [] };
    }
    getState() {
        return this.state;
    }
    getInboxHighlights() {
        return this.state.highlights.filter((highlight) => highlight.status === "inbox");
    }
    async load() {
        const path = this.getStatePath();
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof obsidian_1.TFile)) {
            this.state = this.normalizeState(null);
            return this.state;
        }
        const raw = await this.app.vault.read(file);
        const parsed = raw.trim().length > 0 ? JSON.parse(raw) : null;
        this.state = this.normalizeState(parsed);
        return this.state;
    }
    async save() {
        this.state.updatedAt = nowIso();
        const path = this.getStatePath();
        await this.ensureParentFolder(path);
        const file = this.app.vault.getAbstractFileByPath(path);
        const serialized = `${JSON.stringify(this.state, null, 2)}\n`;
        if (file instanceof obsidian_1.TFile) {
            await this.app.vault.modify(file, serialized);
        }
        else {
            await this.app.vault.create(path, serialized);
        }
    }
    upsertHighlights(incoming) {
        let added = 0;
        let updated = 0;
        const byId = new Map(this.state.highlights.map((highlight) => [highlight.id, highlight]));
        for (const next of incoming) {
            const existing = byId.get(next.id);
            if (!existing) {
                this.state.highlights.push(next);
                byId.set(next.id, next);
                added += 1;
                continue;
            }
            const status = existing.status === "processed" || existing.status === "skipped" ? existing.status : "inbox";
            Object.assign(existing, {
                ...existing,
                readwise_id: existing.readwise_id || next.readwise_id,
                text: existing.text || next.text,
                note: existing.note || next.note,
                source_title: existing.source_title || next.source_title,
                source_author: existing.source_author || next.source_author,
                source_url: existing.source_url || next.source_url,
                source_cover: existing.source_cover || next.source_cover,
                highlighted_at: existing.highlighted_at || next.highlighted_at,
                category: existing.category || next.category,
                readwise_url: existing.readwise_url || next.readwise_url,
                loadedAt: existing.loadedAt || next.loadedAt,
                updatedAt: nowIso(),
                status
            });
            updated += 1;
        }
        this.state.updatedAt = nowIso();
        return { added, updated };
    }
    setCursor(cursor) {
        this.state.last_readwise_cursor = cursor;
        this.state.updatedAt = nowIso();
    }
    async setStatus(id, status) {
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
    getStatePath() {
        return (0, obsidian_1.normalizePath)(this.getSettings().statePath || "readwise-inbox.json");
    }
    normalizeState(raw) {
        const source = raw && typeof raw === "object" ? raw : {};
        const highlights = Array.isArray(source.highlights) ? source.highlights.map((item) => this.normalizeHighlight(item)).filter(Boolean) : [];
        return {
            highlights,
            cards_pending: Array.isArray(source.cards_pending) ? source.cards_pending : [],
            last_readwise_cursor: typeof source.last_readwise_cursor === "string" ? source.last_readwise_cursor : null,
            updatedAt: asString(source.updatedAt, nowIso()),
            schemaVersion: CURRENT_SCHEMA_VERSION
        };
    }
    normalizeHighlight(raw) {
        if (!raw || typeof raw !== "object") {
            return null;
        }
        const item = raw;
        const readwiseId = asString(item.readwise_id || item.id);
        if (!readwiseId) {
            return null;
        }
        const loadedAt = asString(item.loadedAt, nowIso());
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
            status: normalizeStatus(item.status),
            loadedAt,
            updatedAt: asString(item.updatedAt, loadedAt)
        };
    }
    async ensureParentFolder(path) {
        const parts = path.split("/");
        parts.pop();
        const folder = parts.join("/");
        if (!folder) {
            return;
        }
        if (!this.app.vault.getAbstractFileByPath(folder)) {
            await this.app.vault.createFolder(folder);
        }
    }
}
exports.InboxStateStore = InboxStateStore;
