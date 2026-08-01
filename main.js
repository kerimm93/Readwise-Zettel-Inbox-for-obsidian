/* Readwise Inbox Obsidian plugin */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ReadwiseInboxPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/AnkiConnect.ts
var ANKI_CONNECT_ENDPOINT = "http://localhost:8765";
var MODELS = {
  mastery: "Mastery-Notiztyp",
  mc: "Memrise (L\u03C4) Preset [Translation+Listenting | MultipleChoice+Typing] v5.1",
  tapping: "Memrise (L\u03C4) Preset [Translation+Listenting | Tapping+Typing] v5.1",
  cloze: "Memrise (L\u03C4) Cloze Template v5.1"
};
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
  return `\u201E${escapeHtml(highlight.text)}" (${escapeHtml(highlight.source_author)}, ${escapeHtml(highlight.source_title)}) <a href="${escapeHtml(highlight.readwise_url)}">\u{1F4D6} Readwise</a>`;
}
var AnkiConnect = class {
  async ankiRequest(action, params = {}) {
    const response = await fetch(ANKI_CONNECT_ENDPOINT, {
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
      modelName: MODELS.mastery,
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
};

// src/InboxState.ts
var import_obsidian = require("obsidian");

// src/HighlightMerge.ts
function mergeFetchedHighlight(existing, next) {
  return {
    ...existing,
    readwise_id: next.readwise_id,
    text: next.text,
    note: next.note,
    source_title: next.source_title,
    source_author: next.source_author,
    source_url: next.source_url,
    source_cover: next.source_cover,
    highlighted_at: next.highlighted_at,
    category: next.category,
    readwise_url: next.readwise_url,
    updatedAt: next.updatedAt,
    status: existing.status,
    loadedAt: existing.loadedAt
  };
}

// src/InboxState.ts
var CURRENT_SCHEMA_VERSION = 1;
var DEFAULT_STATE = {
  highlights: [],
  cards_pending: [],
  last_readwise_cursor: null,
  updatedAt: (/* @__PURE__ */ new Date(0)).toISOString(),
  schemaVersion: CURRENT_SCHEMA_VERSION
};
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
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
var InboxStateStore = class {
  constructor(app, getSettings) {
    this.app = app;
    this.getSettings = getSettings;
    this.state = { ...DEFAULT_STATE, highlights: [], cards_pending: [] };
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
    if (!(file instanceof import_obsidian.TFile)) {
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
    const serialized = `${JSON.stringify(this.state, null, 2)}
`;
    if (file instanceof import_obsidian.TFile) {
      await this.app.vault.modify(file, serialized);
    } else {
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
      Object.assign(existing, mergeFetchedHighlight(existing, next));
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
    return (0, import_obsidian.normalizePath)(this.getSettings().statePath || "readwise-inbox.json");
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
};

// src/InboxView.ts
var import_obsidian2 = require("obsidian");
var VIEW_TYPE_READWISE_INBOX = "readwise-inbox-view";
var MasteryModal = class extends import_obsidian2.Modal {
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
    new import_obsidian2.Setting(contentEl).setName("Frage").addTextArea((text) => text.setPlaceholder("Frage").setValue(this.frage).onChange((value) => {
      this.frage = value;
    }));
    new import_obsidian2.Setting(contentEl).setName("Antwort").addTextArea((text) => text.setPlaceholder("Antwort").setValue(this.antwort).onChange((value) => {
      this.antwort = value;
    }));
    const quote = contentEl.createDiv({ cls: "rwi-readonly" });
    quote.createEl("strong", { text: "Zitat" });
    quote.createDiv().innerHTML = buildZitatFeld(this.highlight);
    new import_obsidian2.Setting(contentEl).setName("Notizen").addTextArea((text) => text.setValue(this.notizen).onChange((value) => {
      this.notizen = value;
    }));
    const media = contentEl.createDiv({ cls: "rwi-readonly" });
    media.createEl("strong", { text: "Medien" });
    media.createDiv().innerHTML = buildMedienFeld(this.highlight) || "\u2014";
    new import_obsidian2.Setting(contentEl).addButton((button) => button.setButtonText("An Anki senden").setCta().onClick(async () => {
      if (!this.frage.trim() || !this.antwort.trim()) {
        new import_obsidian2.Notice("Frage und Antwort sind erforderlich.");
        return;
      }
      await this.onSubmit(this.frage, this.antwort, this.notizen);
      this.close();
    }));
  }
};
var InboxView = class extends import_obsidian2.ItemView {
  constructor(leaf, deps) {
    super(leaf);
    this.deps = deps;
  }
  getViewType() {
    return VIEW_TYPE_READWISE_INBOX;
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
    titleWrap.createEl("p", { text: "Highlights in Anki-Karten, Atomic Notes oder Skip \xFCberf\xFChren." });
    const fetchButton = header.createEl("button", { text: "Readwise manuell laden", cls: "rwi-button rwi-button-primary" });
    fetchButton.addEventListener("click", () => this.fetchReadwise());
    const highlights = this.deps.stateStore.getInboxHighlights();
    const count = container.createDiv({ cls: "rwi-count" });
    count.textContent = `${highlights.length} Highlight${highlights.length === 1 ? "" : "s"} in der Inbox`;
    if (highlights.length === 0) {
      const empty = container.createDiv({ cls: "rwi-empty" });
      empty.createEl("h2", { text: "Inbox leer" });
      empty.createEl("p", { text: "Lade Readwise manuell oder genie\xDFe die freie Fl\xE4che." });
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
    } catch (error) {
      new import_obsidian2.Notice(error instanceof Error ? error.message : "Readwise Fetch fehlgeschlagen.");
    }
  }
  async skip(highlight) {
    await this.deps.stateStore.setStatus(highlight.id, "skipped");
    new import_obsidian2.Notice("Highlight geskippt.");
    this.render();
  }
  openMastery(highlight) {
    new MasteryModal(this.app, highlight, async (frage, antwort, notizen) => {
      try {
        await this.deps.anki.addMasteryNote(this.deps.getSettings().masteryDeck, highlight, { frage, antwort, notizen });
        await this.deps.stateStore.setStatus(highlight.id, "processed");
        new import_obsidian2.Notice("Mastery Card an Anki gesendet.");
        this.render();
      } catch (error) {
        new import_obsidian2.Notice(error instanceof Error ? `Anki Fehler: ${error.message}` : "Anki Fehler.");
      }
    }).open();
  }
  openAtomic(highlight) {
    this.deps.zettelCreator.openCreateModal(highlight, async () => {
      await this.deps.stateStore.setStatus(highlight.id, "processed");
      new import_obsidian2.Notice("Atomic Note erstellt.");
      this.render();
    });
  }
};

// src/ReadwiseApi.ts
var import_obsidian3 = require("obsidian");

// src/ReadwiseMapping.ts
var READWISE_EXPORT_ENDPOINT = "https://readwise.io/api/v2/export/";
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
function flattenReadwiseExport(data, loadedAt = (/* @__PURE__ */ new Date()).toISOString()) {
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
function mapReadwiseExportHighlight(book, item, loadedAt = (/* @__PURE__ */ new Date()).toISOString()) {
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

// src/ReadwiseApi.ts
var ReadwiseApi = class {
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
    const url = new URL(READWISE_EXPORT_ENDPOINT);
    if (state.last_readwise_cursor) {
      url.searchParams.set("pageCursor", state.last_readwise_cursor);
    } else {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
      url.searchParams.set("updatedAfter", since);
    }
    const response = await (0, import_obsidian3.requestUrl)({
      url: url.toString(),
      method: "GET",
      headers: { Authorization: `Token ${token}` }
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Readwise Fetch fehlgeschlagen (${response.status}).`);
    }
    const data = response.json;
    const highlights = flattenReadwiseExport(data);
    const counts = this.stateStore.upsertHighlights(highlights);
    const cursor = getReadwiseCursor(data);
    this.stateStore.setCursor(cursor);
    await this.stateStore.save();
    new import_obsidian3.Notice(`Readwise geladen: ${counts.added} neu, ${counts.updated} aktualisiert.`);
    return { ...counts, cursor };
  }
};

// src/ZettelCreator.ts
var import_obsidian4 = require("obsidian");
function today() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function cleanSegment(value) {
  return value.trim().replace(/[\\/:*?"<>|]/g, "-");
}
function yamlString(value) {
  return JSON.stringify(value);
}
var ParentSuggestModal = class extends import_obsidian4.FuzzySuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder("Parent-Note nach title-Frontmatter oder Dateiname suchen...");
  }
  getItems() {
    return this.app.vault.getMarkdownFiles().map((file) => {
      var _a;
      const cache = this.app.metadataCache.getFileCache(file);
      const title = typeof ((_a = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a.title) === "string" ? cache.frontmatter.title : file.basename;
      return { title, path: file.path, basename: file.basename };
    });
  }
  getItemText(item) {
    return `${item.title} \u2014 ${item.path}`;
  }
  onChooseItem(item) {
    this.onChoose(item);
  }
};
var AtomicNoteModal = class extends import_obsidian4.Modal {
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
    new import_obsidian4.Setting(contentEl).setName("Parent").setDesc(this.parent ? `${this.parent.title} (${this.parent.path})` : "Parent per Fuzzy Search ausw\xE4hlen").addButton((button) => button.setButtonText("Parent suchen").onClick(() => {
      new ParentSuggestModal(this.app, (candidate) => {
        this.parent = candidate;
        this.render();
      }).open();
    }));
    new import_obsidian4.Setting(contentEl).setName("K\xFCrzel").setDesc("Dateiname wird <parent-basename>.<k>.md").addText((text) => text.setPlaceholder("k").setValue(this.kuerzel).onChange((value) => {
      this.kuerzel = value;
    }));
    new import_obsidian4.Setting(contentEl).setName("Titel").addTextArea((text) => text.setValue(this.title).onChange((value) => {
      this.title = value;
    }));
    new import_obsidian4.Setting(contentEl).setName("Beschreibung").addText((text) => text.setValue(this.desc).onChange((value) => {
      this.desc = value;
    }));
    new import_obsidian4.Setting(contentEl).setName("Notiz").addTextArea((text) => text.setValue(this.note).onChange((value) => {
      this.note = value;
    }));
    contentEl.createEl("blockquote", { text: this.highlight.text });
    new import_obsidian4.Setting(contentEl).addButton((button) => button.setButtonText("Erstellen").setCta().onClick(async () => {
      if (!this.parent) {
        new import_obsidian4.Notice("Bitte zuerst eine Parent-Note ausw\xE4hlen.");
        return;
      }
      if (!this.kuerzel.trim()) {
        new import_obsidian4.Notice("Bitte ein K\xFCrzel eingeben.");
        return;
      }
      try {
        await this.onSubmit({ parent: this.parent, kuerzel: this.kuerzel, title: this.title, desc: this.desc, note: this.note });
        this.close();
      } catch (error) {
        new import_obsidian4.Notice(error instanceof Error ? error.message : "Atomic Note konnte nicht erstellt werden.");
      }
    }));
  }
};
var ZettelCreator = class {
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
    const folder = (0, import_obsidian4.normalizePath)(this.getSettings().zettelFolder || "");
    if (folder) {
      await this.ensureFolder(folder);
    }
    const filename = `${input.parent.basename}.${cleanSegment(input.kuerzel)}.md`;
    const path = (0, import_obsidian4.normalizePath)(folder ? `${folder}/${filename}` : filename);
    if (this.app.vault.getAbstractFileByPath(path)) {
      throw new Error(`Datei existiert bereits: ${path}`);
    }
    const markdown = this.buildMarkdown(highlight, input);
    const file = await this.app.vault.create(path, markdown);
    await this.app.workspace.getLeaf("tab").openFile(file);
    return file;
  }
  buildMarkdown(highlight, input) {
    return `---
title: ${yamlString(input.title)}
alias: ${yamlString(input.title)}
desc: ${yamlString(input.desc)}
tags:
  - proto-atomic
created: ${today()}
rwi_source: readwise
---

# ${input.title}

${input.note}

## \u{1F4D6} Quelle

\u201E${highlight.text}"
(${highlight.source_author}, ${highlight.source_title})
[\u{1F4D6} Original in Readwise](${highlight.readwise_url})
`;
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
};

// src/main.ts
var DEFAULT_SETTINGS = {
  readwiseToken: "",
  masteryDeck: "Mastery",
  memriseDeck: "Memrise",
  statePath: "readwise-inbox.json",
  zettelFolder: ""
};
var ReadwiseInboxPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.stateStore = new InboxStateStore(this.app, () => this.settings);
    await this.stateStore.load();
    this.readwiseApi = new ReadwiseApi(() => this.settings, this.stateStore);
    this.anki = new AnkiConnect();
    this.zettelCreator = new ZettelCreator(this.app, () => this.settings);
    this.registerView(VIEW_TYPE_READWISE_INBOX, (leaf) => new InboxView(leaf, {
      stateStore: this.stateStore,
      readwiseApi: this.readwiseApi,
      anki: this.anki,
      zettelCreator: this.zettelCreator,
      getSettings: () => this.settings
    }));
    this.addRibbonIcon("inbox", "Readwise Inbox \xF6ffnen", () => this.activateView());
    this.addCommand({
      id: "open-readwise-inbox",
      name: "Readwise Inbox \xF6ffnen",
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
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_READWISE_INBOX);
  }
  async activateView() {
    var _a;
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_READWISE_INBOX);
    let leaf;
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = (_a = this.app.workspace.getRightLeaf(false)) != null ? _a : this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_READWISE_INBOX, active: true });
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
      new import_obsidian5.Notice(`AnkiConnect verbunden (Version ${version}).`);
    } catch (error) {
      new import_obsidian5.Notice(error instanceof Error ? `AnkiConnect nicht erreichbar: ${error.message}` : "AnkiConnect nicht erreichbar.");
    }
  }
};
var ReadwiseInboxSettingTab = class extends import_obsidian5.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("rwi-settings");
    containerEl.createEl("h2", { text: "Readwise Inbox Einstellungen" });
    new import_obsidian5.Setting(containerEl).setName("Readwise API Token").setDesc("Token wird lokal in den Obsidian Plugin-Daten gespeichert und nicht ins Repository geschrieben.").addText((text) => {
      text.inputEl.type = "password";
      text.setPlaceholder("Readwise Token").setValue(this.plugin.settings.readwiseToken).onChange(async (value) => {
        this.plugin.settings.readwiseToken = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian5.Setting(containerEl).setName("Mastery Deck").addText((text) => text.setValue(this.plugin.settings.masteryDeck).onChange(async (value) => {
      this.plugin.settings.masteryDeck = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian5.Setting(containerEl).setName("Memrise Deck").setDesc("Sprint 1 legt nur die Settings und Modellkonstanten an; kein vollst\xE4ndiger Memrise-Flow.").addText((text) => text.setValue(this.plugin.settings.memriseDeck).onChange(async (value) => {
      this.plugin.settings.memriseDeck = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian5.Setting(containerEl).setName("State-Dateipfad").setDesc("Default: readwise-inbox.json").addText((text) => text.setValue(this.plugin.settings.statePath).onChange(async (value) => {
      this.plugin.settings.statePath = value.trim() || "readwise-inbox.json";
      await this.plugin.saveSettings();
      await this.plugin.stateStore.load();
    }));
    new import_obsidian5.Setting(containerEl).setName("Zettel-Zielordner").setDesc("Leer lassen f\xFCr Vault-Root.").addText((text) => text.setPlaceholder("z.B. Zettel").setValue(this.plugin.settings.zettelFolder).onChange(async (value) => {
      this.plugin.settings.zettelFolder = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian5.Setting(containerEl).setName("AnkiConnect").setDesc("Testet http://localhost:8765").addButton((button) => button.setButtonText("Verbindung testen").onClick(() => this.plugin.testAnki()));
  }
};
