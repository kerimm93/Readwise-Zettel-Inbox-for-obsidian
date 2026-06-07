/* Readwise Inbox Obsidian plugin - bundled runtime */
(function(){
const __modules = {};
const __cache = {};
function __define(id, factory){ __modules[id] = factory; }
function __require(id){
  if (id === "obsidian") return require("obsidian");
  if (id.startsWith("./")) id = id.slice(2);
  if (__cache[id]) return __cache[id].exports;
  if (!__modules[id]) throw new Error("Cannot find module " + id);
  const module = { exports: {} };
  __cache[id] = module;
  __modules[id](__require, module, module.exports);
  return module.exports;
}
__define("types", function(require, module, exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

});
__define("ReadwiseMapping", function(require, module, exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.READWISE_EXPORT_ENDPOINT = void 0;
exports.getReadwiseCursor = getReadwiseCursor;
exports.flattenReadwiseExport = flattenReadwiseExport;
exports.mapReadwiseExportHighlight = mapReadwiseExportHighlight;
exports.READWISE_EXPORT_ENDPOINT = "https://readwise.io/api/v2/export/";
function stringValue(value, fallback = "") {
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "bigint") {
        return String(value);
    }
    return fallback;
}
function firstString(...values) {
    for (const value of values) {
        const normalized = stringValue(value);
        if (normalized.length > 0) {
            return normalized;
        }
    }
    return "";
}
function objectValue(value) {
    return value && typeof value === "object" ? value : {};
}
function getReadwiseCursor(data) {
    return firstString(data.nextPageCursor, data.next_page_cursor, data.nextCursor) || null;
}
function flattenReadwiseExport(data, loadedAt = new Date().toISOString()) {
    const results = Array.isArray(data.results) ? data.results : [];
    const mapped = [];
    for (const rawBook of results) {
        const book = objectValue(rawBook);
        const highlights = Array.isArray(book.highlights) ? book.highlights : [];
        for (const rawHighlight of highlights) {
            const highlight = mapReadwiseExportHighlight(book, objectValue(rawHighlight), loadedAt);
            if (highlight) {
                mapped.push(highlight);
            }
        }
    }
    return mapped;
}
function mapReadwiseExportHighlight(book, item, loadedAt = new Date().toISOString()) {
    const id = firstString(item.id, item.highlight_id, item.readwise_id);
    if (!id) {
        return null;
    }
    return {
        id,
        readwise_id: id,
        text: firstString(item.text, item.highlight, item.content),
        note: firstString(item.note, item.notes),
        source_title: firstString(item.source_title, item.title, book.title, "Untitled"),
        source_author: firstString(item.source_author, item.author, book.author, "Unknown author"),
        source_url: firstString(item.source_url, item.url, book.source_url),
        source_cover: firstString(item.source_cover, item.cover_image_url, item.image_url, book.cover_image_url, book.image_url),
        highlighted_at: firstString(item.highlighted_at, item.created_at, item.updated_at),
        category: firstString(item.category, book.category, "highlight"),
        readwise_url: firstString(item.readwise_url, book.readwise_url, item.url),
        status: "inbox",
        loadedAt,
        updatedAt: loadedAt
    };
}

});
__define("AnkiConnect", function(require, module, exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnkiConnect = exports.MODELS = exports.ANKI_CONNECT_ENDPOINT = void 0;
exports.buildMedienFeld = buildMedienFeld;
exports.buildZitatFeld = buildZitatFeld;
exports.ANKI_CONNECT_ENDPOINT = "http://localhost:8765";
exports.MODELS = {
    mastery: "Mastery-Notiztyp",
    mc: "Memrise (Lτ) Preset [Translation+Listenting | MultipleChoice+Typing] v5.1",
    tapping: "Memrise (Lτ) Preset [Translation+Listenting | Tapping+Typing] v5.1",
    cloze: "Memrise (Lτ) Cloze Template v5.1"
};
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function buildMedienFeld(highlight) {
    const rows = [
        ["Autor", highlight.source_author],
        ["Titel", highlight.source_title],
        ["Category", highlight.category]
    ].filter(([, value]) => value);
    const parts = rows.map(([label, value]) => `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}`);
    if (highlight.source_url) {
        parts.push(`<a href="${escapeHtml(highlight.source_url)}">Quelle</a>`);
    }
    if (highlight.source_cover) {
        parts.push(`<img src="${escapeHtml(highlight.source_cover)}" alt="Cover">`);
    }
    return parts.join("<br>");
}
function buildZitatFeld(highlight) {
    return `„${escapeHtml(highlight.text)}" (${escapeHtml(highlight.source_author)}, ${escapeHtml(highlight.source_title)}) <a href="${escapeHtml(highlight.readwise_url)}">📖 Readwise</a>`;
}
class AnkiConnect {
    async ankiRequest(action, params = {}) {
        const response = await fetch(exports.ANKI_CONNECT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, version: 6, params })
        });
        if (!response.ok) {
            throw new Error(`AnkiConnect HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (payload.error) {
            throw new Error(payload.error);
        }
        return payload.result;
    }
    async testConnection() {
        return this.ankiRequest("version");
    }
    buildMasteryNote(deckName, highlight, input) {
        return {
            deckName,
            modelName: exports.MODELS.mastery,
            fields: {
                Frage: input.frage,
                Antwort: input.antwort,
                Zitat: buildZitatFeld(highlight),
                Notizen: input.notizen,
                Medien: buildMedienFeld(highlight)
            },
            options: { allowDuplicate: false },
            tags: ["readwise-inbox", "mastery"]
        };
    }
    async addMasteryNote(deckName, highlight, input) {
        const note = this.buildMasteryNote(deckName, highlight, input);
        return this.ankiRequest("addNote", { note });
    }
}
exports.AnkiConnect = AnkiConnect;

});
__define("InboxState", function(require, module, exports) {
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

});
__define("ReadwiseApi", function(require, module, exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadwiseApi = void 0;
const obsidian_1 = require("obsidian");
const ReadwiseMapping_1 = require("./ReadwiseMapping");
class ReadwiseApi {
    constructor(getSettings, stateStore) {
        this.getSettings = getSettings;
        this.stateStore = stateStore;
    }
    async fetchHighlights() {
        const token = this.getSettings().readwiseToken.trim();
        if (!token) {
            throw new Error("Readwise API Token fehlt in den Plugin-Einstellungen.");
        }
        const state = this.stateStore.getState();
        const url = new URL(ReadwiseMapping_1.READWISE_EXPORT_ENDPOINT);
        if (state.last_readwise_cursor) {
            url.searchParams.set("pageCursor", state.last_readwise_cursor);
        }
        else {
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            url.searchParams.set("updatedAfter", since);
        }
        const response = await (0, obsidian_1.requestUrl)({
            url: url.toString(),
            method: "GET",
            headers: { Authorization: `Token ${token}` }
        });
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Readwise Fetch fehlgeschlagen (${response.status}).`);
        }
        const data = response.json;
        const highlights = (0, ReadwiseMapping_1.flattenReadwiseExport)(data);
        const counts = this.stateStore.upsertHighlights(highlights);
        const cursor = (0, ReadwiseMapping_1.getReadwiseCursor)(data);
        this.stateStore.setCursor(cursor);
        await this.stateStore.save();
        new obsidian_1.Notice(`Readwise geladen: ${counts.added} neu, ${counts.updated} aktualisiert.`);
        return { ...counts, cursor };
    }
}
exports.ReadwiseApi = ReadwiseApi;

});
__define("ZettelCreator", function(require, module, exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZettelCreator = exports.AtomicNoteModal = exports.ParentSuggestModal = void 0;
const obsidian_1 = require("obsidian");
function today() {
    return new Date().toISOString().slice(0, 10);
}
function cleanSegment(value) {
    return value.trim().replace(/[\\/:*?"<>|]/g, "-");
}
function yamlString(value) {
    return JSON.stringify(value);
}
class ParentSuggestModal extends obsidian_1.FuzzySuggestModal {
    constructor(app, onChoose) {
        super(app);
        this.onChoose = onChoose;
        this.setPlaceholder("Parent-Note nach title-Frontmatter oder Dateiname suchen...");
    }
    getItems() {
        return this.app.vault.getMarkdownFiles().map((file) => {
            var _a;
            const cache = this.app.metadataCache.getFileCache(file);
            const title = typeof ((_a = cache === null || cache === void 0 ? void 0 : cache.frontmatter) === null || _a === void 0 ? void 0 : _a.title) === "string" ? cache.frontmatter.title : file.basename;
            return { title, path: file.path, basename: file.basename };
        });
    }
    getItemText(item) {
        return `${item.title} — ${item.path}`;
    }
    onChooseItem(item) {
        this.onChoose(item);
    }
}
exports.ParentSuggestModal = ParentSuggestModal;
class AtomicNoteModal extends obsidian_1.Modal {
    constructor(app, highlight, onSubmit) {
        super(app);
        this.highlight = highlight;
        this.onSubmit = onSubmit;
        this.parent = null;
        this.kuerzel = "";
        this.title = "";
        this.desc = "";
        this.note = "";
        this.title = highlight.text.slice(0, 80).replace(/\s+/g, " ").trim();
        this.desc = highlight.source_title;
        this.note = highlight.note;
    }
    onOpen() {
        this.render();
    }
    render() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("rwi-modal");
        contentEl.createEl("h2", { text: "Atomic Note erstellen" });
        new obsidian_1.Setting(contentEl)
            .setName("Parent")
            .setDesc(this.parent ? `${this.parent.title} (${this.parent.path})` : "Parent per Fuzzy Search auswählen")
            .addButton((button) => button.setButtonText("Parent suchen").onClick(() => {
            new ParentSuggestModal(this.app, (candidate) => {
                this.parent = candidate;
                this.render();
            }).open();
        }));
        new obsidian_1.Setting(contentEl)
            .setName("Kürzel")
            .setDesc("Dateiname wird <parent-basename>.<k>.md")
            .addText((text) => text.setPlaceholder("k").setValue(this.kuerzel).onChange((value) => { this.kuerzel = value; }));
        new obsidian_1.Setting(contentEl)
            .setName("Titel")
            .addTextArea((text) => text.setValue(this.title).onChange((value) => { this.title = value; }));
        new obsidian_1.Setting(contentEl)
            .setName("Beschreibung")
            .addText((text) => text.setValue(this.desc).onChange((value) => { this.desc = value; }));
        new obsidian_1.Setting(contentEl)
            .setName("Notiz")
            .addTextArea((text) => text.setValue(this.note).onChange((value) => { this.note = value; }));
        contentEl.createEl("blockquote", { text: this.highlight.text });
        new obsidian_1.Setting(contentEl)
            .addButton((button) => button.setButtonText("Erstellen").setCta().onClick(async () => {
            if (!this.parent) {
                new obsidian_1.Notice("Bitte zuerst eine Parent-Note auswählen.");
                return;
            }
            if (!this.kuerzel.trim()) {
                new obsidian_1.Notice("Bitte ein Kürzel eingeben.");
                return;
            }
            try {
                await this.onSubmit({ parent: this.parent, kuerzel: this.kuerzel, title: this.title, desc: this.desc, note: this.note });
                this.close();
            }
            catch (error) {
                new obsidian_1.Notice(error instanceof Error ? error.message : "Atomic Note konnte nicht erstellt werden.");
            }
        }));
    }
}
exports.AtomicNoteModal = AtomicNoteModal;
class ZettelCreator {
    constructor(app, getSettings) {
        this.app = app;
        this.getSettings = getSettings;
    }
    openCreateModal(highlight, onCreated) {
        new AtomicNoteModal(this.app, highlight, async (input) => {
            const file = await this.createAtomicNote(highlight, input);
            await onCreated(file);
        }).open();
    }
    async createAtomicNote(highlight, input) {
        const folder = (0, obsidian_1.normalizePath)(this.getSettings().zettelFolder || "");
        if (folder) {
            await this.ensureFolder(folder);
        }
        const filename = `${input.parent.basename}.${cleanSegment(input.kuerzel)}.md`;
        const path = (0, obsidian_1.normalizePath)(folder ? `${folder}/${filename}` : filename);
        if (this.app.vault.getAbstractFileByPath(path)) {
            throw new Error(`Datei existiert bereits: ${path}`);
        }
        const markdown = this.buildMarkdown(highlight, input);
        const file = await this.app.vault.create(path, markdown);
        await this.app.workspace.getLeaf("tab").openFile(file);
        return file;
    }
    buildMarkdown(highlight, input) {
        return `---\ntitle: ${yamlString(input.title)}\nalias: ${yamlString(input.title)}\ndesc: ${yamlString(input.desc)}\ntags:\n  - proto-atomic\ncreated: ${today()}\nrwi_source: readwise\n---\n\n# ${input.title}\n\n${input.note}\n\n## 📖 Quelle\n\n„${highlight.text}"\n(${highlight.source_author}, ${highlight.source_title})\n[📖 Original in Readwise](${highlight.readwise_url})\n`;
    }
    async ensureFolder(folder) {
        const parts = folder.split("/").filter(Boolean);
        let current = "";
        for (const part of parts) {
            current = current ? `${current}/${part}` : part;
            if (!this.app.vault.getAbstractFileByPath(current)) {
                await this.app.vault.createFolder(current);
            }
        }
    }
}
exports.ZettelCreator = ZettelCreator;

});
__define("InboxView", function(require, module, exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InboxView = exports.VIEW_TYPE_READWISE_INBOX = void 0;
const obsidian_1 = require("obsidian");
const AnkiConnect_1 = require("./AnkiConnect");
exports.VIEW_TYPE_READWISE_INBOX = "readwise-inbox-view";
class MasteryModal extends obsidian_1.Modal {
    constructor(app, highlight, onSubmit) {
        super(app);
        this.highlight = highlight;
        this.onSubmit = onSubmit;
        this.frage = "";
        this.antwort = "";
        this.notizen = highlight.note;
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("rwi-modal");
        contentEl.createEl("h2", { text: "Mastery Card" });
        new obsidian_1.Setting(contentEl)
            .setName("Frage")
            .addTextArea((text) => text.setPlaceholder("Frage").setValue(this.frage).onChange((value) => { this.frage = value; }));
        new obsidian_1.Setting(contentEl)
            .setName("Antwort")
            .addTextArea((text) => text.setPlaceholder("Antwort").setValue(this.antwort).onChange((value) => { this.antwort = value; }));
        const quote = contentEl.createDiv({ cls: "rwi-readonly" });
        quote.createEl("strong", { text: "Zitat" });
        quote.createDiv().innerHTML = (0, AnkiConnect_1.buildZitatFeld)(this.highlight);
        new obsidian_1.Setting(contentEl)
            .setName("Notizen")
            .addTextArea((text) => text.setValue(this.notizen).onChange((value) => { this.notizen = value; }));
        const media = contentEl.createDiv({ cls: "rwi-readonly" });
        media.createEl("strong", { text: "Medien" });
        media.createDiv().innerHTML = (0, AnkiConnect_1.buildMedienFeld)(this.highlight) || "—";
        new obsidian_1.Setting(contentEl)
            .addButton((button) => button.setButtonText("An Anki senden").setCta().onClick(async () => {
            if (!this.frage.trim() || !this.antwort.trim()) {
                new obsidian_1.Notice("Frage und Antwort sind erforderlich.");
                return;
            }
            await this.onSubmit(this.frage, this.antwort, this.notizen);
            this.close();
        }));
    }
}
class InboxView extends obsidian_1.ItemView {
    constructor(leaf, deps) {
        super(leaf);
        this.deps = deps;
    }
    getViewType() {
        return exports.VIEW_TYPE_READWISE_INBOX;
    }
    getDisplayText() {
        return "Readwise Inbox";
    }
    getIcon() {
        return "inbox";
    }
    async onOpen() {
        await this.deps.stateStore.load();
        this.render();
    }
    render() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass("rwi-view");
        const header = container.createDiv({ cls: "rwi-header" });
        const titleWrap = header.createDiv();
        titleWrap.createEl("h1", { text: "Readwise Inbox" });
        titleWrap.createEl("p", { text: "Highlights in Anki-Karten, Atomic Notes oder Skip überführen." });
        const fetchButton = header.createEl("button", { text: "Readwise manuell laden", cls: "rwi-button rwi-button-primary" });
        fetchButton.addEventListener("click", () => this.fetchReadwise());
        const highlights = this.deps.stateStore.getInboxHighlights();
        const count = container.createDiv({ cls: "rwi-count" });
        count.textContent = `${highlights.length} Highlight${highlights.length === 1 ? "" : "s"} in der Inbox`;
        if (highlights.length === 0) {
            const empty = container.createDiv({ cls: "rwi-empty" });
            empty.createEl("h2", { text: "Inbox leer" });
            empty.createEl("p", { text: "Lade Readwise manuell oder genieße die freie Fläche." });
            return;
        }
        const list = container.createDiv({ cls: "rwi-list" });
        for (const highlight of highlights) {
            list.appendChild(this.renderHighlight(highlight));
        }
    }
    renderHighlight(highlight) {
        const card = createDiv({ cls: "rwi-card" });
        const meta = card.createDiv({ cls: "rwi-meta" });
        meta.createSpan({ text: highlight.source_author || "Unknown author" });
        meta.createSpan({ text: highlight.source_title || "Untitled" });
        card.createEl("blockquote", { text: highlight.text, cls: "rwi-quote" });
        if (highlight.note) {
            const note = card.createDiv({ cls: "rwi-note" });
            note.createEl("strong", { text: "Note: " });
            note.appendText(highlight.note);
        }
        const actions = card.createDiv({ cls: "rwi-actions" });
        actions.createEl("button", { text: "Mastery Card", cls: "rwi-button rwi-button-primary" }).addEventListener("click", () => this.openMastery(highlight));
        actions.createEl("button", { text: "Atomic Note", cls: "rwi-button" }).addEventListener("click", () => this.openAtomic(highlight));
        actions.createEl("button", { text: "Skip", cls: "rwi-button rwi-button-muted" }).addEventListener("click", () => this.skip(highlight));
        return card;
    }
    async fetchReadwise() {
        try {
            await this.deps.readwiseApi.fetchHighlights();
            this.render();
        }
        catch (error) {
            new obsidian_1.Notice(error instanceof Error ? error.message : "Readwise Fetch fehlgeschlagen.");
        }
    }
    async skip(highlight) {
        await this.deps.stateStore.setStatus(highlight.id, "skipped");
        new obsidian_1.Notice("Highlight geskippt.");
        this.render();
    }
    openMastery(highlight) {
        new MasteryModal(this.app, highlight, async (frage, antwort, notizen) => {
            try {
                await this.deps.anki.addMasteryNote(this.deps.getSettings().masteryDeck, highlight, { frage, antwort, notizen });
                await this.deps.stateStore.setStatus(highlight.id, "processed");
                new obsidian_1.Notice("Mastery Card an Anki gesendet.");
                this.render();
            }
            catch (error) {
                new obsidian_1.Notice(error instanceof Error ? `Anki Fehler: ${error.message}` : "Anki Fehler.");
            }
        }).open();
    }
    openAtomic(highlight) {
        this.deps.zettelCreator.openCreateModal(highlight, async () => {
            await this.deps.stateStore.setStatus(highlight.id, "processed");
            new obsidian_1.Notice("Atomic Note erstellt.");
            this.render();
        });
    }
}
exports.InboxView = InboxView;

});
__define("main", function(require, module, exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const AnkiConnect_1 = require("./AnkiConnect");
const InboxState_1 = require("./InboxState");
const InboxView_1 = require("./InboxView");
const ReadwiseApi_1 = require("./ReadwiseApi");
const ZettelCreator_1 = require("./ZettelCreator");
const DEFAULT_SETTINGS = {
    readwiseToken: "",
    masteryDeck: "Mastery",
    memriseDeck: "Memrise",
    statePath: "readwise-inbox.json",
    zettelFolder: ""
};
class ReadwiseInboxPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.settings = DEFAULT_SETTINGS;
    }
    async onload() {
        await this.loadSettings();
        this.stateStore = new InboxState_1.InboxStateStore(this.app, () => this.settings);
        await this.stateStore.load();
        this.readwiseApi = new ReadwiseApi_1.ReadwiseApi(() => this.settings, this.stateStore);
        this.anki = new AnkiConnect_1.AnkiConnect();
        this.zettelCreator = new ZettelCreator_1.ZettelCreator(this.app, () => this.settings);
        this.registerView(InboxView_1.VIEW_TYPE_READWISE_INBOX, (leaf) => new InboxView_1.InboxView(leaf, {
            stateStore: this.stateStore,
            readwiseApi: this.readwiseApi,
            anki: this.anki,
            zettelCreator: this.zettelCreator,
            getSettings: () => this.settings
        }));
        this.addRibbonIcon("inbox", "Readwise Inbox öffnen", () => this.activateView());
        this.addCommand({
            id: "open-readwise-inbox",
            name: "Readwise Inbox öffnen",
            callback: () => this.activateView()
        });
        this.addCommand({
            id: "test-ankiconnect",
            name: "AnkiConnect Verbindung testen",
            callback: () => this.testAnki()
        });
        this.addSettingTab(new ReadwiseInboxSettingTab(this.app, this));
    }
    onunload() {
        this.app.workspace.detachLeavesOfType(InboxView_1.VIEW_TYPE_READWISE_INBOX);
    }
    async activateView() {
        var _a;
        const leaves = this.app.workspace.getLeavesOfType(InboxView_1.VIEW_TYPE_READWISE_INBOX);
        let leaf;
        if (leaves.length > 0) {
            leaf = leaves[0];
        }
        else {
            leaf = (_a = this.app.workspace.getRightLeaf(false)) !== null && _a !== void 0 ? _a : this.app.workspace.getLeaf(true);
            await leaf.setViewState({ type: InboxView_1.VIEW_TYPE_READWISE_INBOX, active: true });
        }
        this.app.workspace.revealLeaf(leaf);
    }
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
    async testAnki() {
        try {
            const version = await this.anki.testConnection();
            new obsidian_1.Notice(`AnkiConnect verbunden (Version ${version}).`);
        }
        catch (error) {
            new obsidian_1.Notice(error instanceof Error ? `AnkiConnect nicht erreichbar: ${error.message}` : "AnkiConnect nicht erreichbar.");
        }
    }
}
exports.default = ReadwiseInboxPlugin;
class ReadwiseInboxSettingTab extends obsidian_1.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass("rwi-settings");
        containerEl.createEl("h2", { text: "Readwise Inbox Einstellungen" });
        new obsidian_1.Setting(containerEl)
            .setName("Readwise API Token")
            .setDesc("Token wird lokal in den Obsidian Plugin-Daten gespeichert und nicht ins Repository geschrieben.")
            .addText((text) => {
            text.inputEl.type = "password";
            text.setPlaceholder("Readwise Token").setValue(this.plugin.settings.readwiseToken).onChange(async (value) => {
                this.plugin.settings.readwiseToken = value.trim();
                await this.plugin.saveSettings();
            });
        });
        new obsidian_1.Setting(containerEl)
            .setName("Mastery Deck")
            .addText((text) => text.setValue(this.plugin.settings.masteryDeck).onChange(async (value) => {
            this.plugin.settings.masteryDeck = value;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Memrise Deck")
            .setDesc("Sprint 1 legt nur die Settings und Modellkonstanten an; kein vollständiger Memrise-Flow.")
            .addText((text) => text.setValue(this.plugin.settings.memriseDeck).onChange(async (value) => {
            this.plugin.settings.memriseDeck = value;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("State-Dateipfad")
            .setDesc("Default: readwise-inbox.json")
            .addText((text) => text.setValue(this.plugin.settings.statePath).onChange(async (value) => {
            this.plugin.settings.statePath = value.trim() || "readwise-inbox.json";
            await this.plugin.saveSettings();
            await this.plugin.stateStore.load();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Zettel-Zielordner")
            .setDesc("Leer lassen für Vault-Root.")
            .addText((text) => text.setPlaceholder("z.B. Zettel").setValue(this.plugin.settings.zettelFolder).onChange(async (value) => {
            this.plugin.settings.zettelFolder = value.trim();
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("AnkiConnect")
            .setDesc("Testet http://localhost:8765")
            .addButton((button) => button.setButtonText("Verbindung testen").onClick(() => this.plugin.testAnki()));
    }
}

});
module.exports = __require("main").default;
})();
