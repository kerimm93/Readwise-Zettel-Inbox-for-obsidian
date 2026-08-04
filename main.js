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
var import_obsidian6 = require("obsidian");

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
    tags: next.tags,
    updatedAt: next.updatedAt,
    status: existing.status,
    loadedAt: existing.loadedAt
  };
}

// src/WorkflowRouting.ts
function normalizeTags(raw) {
  if (!Array.isArray(raw)) return [];
  const values = raw.map((entry) => {
    if (typeof entry === "string") return entry;
    if (entry && typeof entry === "object" && typeof entry.name === "string") {
      return entry.name;
    }
    return "";
  }).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  return [...new Set(values)];
}
function hasRoute(highlight, route) {
  return highlight.tags.includes(route === "atomic" ? "make-atomic" : "reflect");
}
function isRouteOpen(highlight, route) {
  return hasRoute(highlight, route) && highlight.workflow[route] === "open";
}
function isMasteryAvailable(highlight) {
  if (highlight.status !== "inbox") return false;
  return highlight.tags.length === 0 || highlight.tags.includes("make-anki");
}
function isReflectManageable(highlight) {
  return hasRoute(highlight, "reflect") && highlight.workflow.reflect === "processed";
}
function isWorkflowVisible(highlight) {
  if (isRouteOpen(highlight, "atomic") || isRouteOpen(highlight, "reflect")) return true;
  return isReflectManageable(highlight) || isMasteryAvailable(highlight);
}
function reflectActionState(highlight, hasConfirmedFile) {
  const routed = hasRoute(highlight, "reflect");
  return {
    canOpen: routed && highlight.workflow.reflect !== "skipped",
    canReset: routed && highlight.workflow.reflect === "processed" && hasConfirmedFile,
    canMark: routed && highlight.workflow.reflect === "open" && hasConfirmedFile,
    canSkip: routed && highlight.workflow.reflect === "open"
  };
}
function reflectButtonLabels(actions) {
  const labels = [];
  if (actions.canOpen) labels.push("Reflect \xF6ffnen");
  if (actions.canMark) labels.push("Als reflektiert markieren");
  if (actions.canReset) labels.push("Reflexion zur\xFCcksetzen");
  if (actions.canSkip) labels.push("Reflect skip");
  return labels;
}
function isConfirmedReflectResolution(kind) {
  return kind === "found";
}
function recordConfirmedReflectFile(confirmed, highlightId) {
  confirmed.add(highlightId);
}
function normalizeWorkflow(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const status = (item) => item === "processed" || item === "skipped" || item === "open" ? item : "open";
  return {
    atomic: status(value.atomic),
    reflect: status(value.reflect),
    reflectFilePath: typeof value.reflectFilePath === "string" ? value.reflectFilePath : ""
  };
}
function reconcileReflectStatus(currentStatus, fileExists, reflected) {
  if (currentStatus === "skipped") return "skipped";
  if (!fileExists) return currentStatus === "processed" ? "open" : currentStatus;
  return reflected ? "processed" : "open";
}
function shouldUpdateReflectFilePath(currentPath, resolvedPath) {
  return currentPath !== resolvedPath;
}
function shouldUpdateWorkflowStatus(currentStatus, nextStatus) {
  return currentStatus !== nextStatus;
}

// src/StateMigration.ts
function normalizeSourceSchemaVersion(value) {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 1 ? value : 1;
}
function normalizeWorkflowForState(rawWorkflow, globalStatus, sourceSchemaVersion) {
  const hasExplicitWorkflow = rawWorkflow !== null && typeof rawWorkflow === "object" && !Array.isArray(rawWorkflow);
  if (hasExplicitWorkflow) return normalizeWorkflow(rawWorkflow);
  if (sourceSchemaVersion === 1 && globalStatus === "skipped") {
    return { atomic: "skipped", reflect: "skipped", reflectFilePath: "" };
  }
  return normalizeWorkflow(void 0);
}

// src/InboxState.ts
var CURRENT_SCHEMA_VERSION = 2;
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
    return this.state.highlights.filter((highlight) => isWorkflowVisible(highlight));
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
  async setWorkflowStatus(id, route, status) {
    const highlight = this.state.highlights.find((item) => item.id === id);
    if (!highlight) return false;
    if (!shouldUpdateWorkflowStatus(highlight.workflow[route], status)) return true;
    highlight.workflow[route] = status;
    highlight.updatedAt = nowIso();
    await this.save();
    return true;
  }
  async setReflectFilePath(id, path) {
    const highlight = this.state.highlights.find((item) => item.id === id);
    if (!highlight) return false;
    const normalizedPath = (0, import_obsidian.normalizePath)(path);
    if (!shouldUpdateReflectFilePath((0, import_obsidian.normalizePath)(highlight.workflow.reflectFilePath || ""), normalizedPath)) return true;
    highlight.workflow.reflectFilePath = normalizedPath;
    highlight.updatedAt = nowIso();
    await this.save();
    return true;
  }
  getStatePath() {
    return (0, import_obsidian.normalizePath)(this.getSettings().statePath || "readwise-inbox.json");
  }
  normalizeState(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const sourceSchemaVersion = normalizeSourceSchemaVersion(source.schemaVersion);
    const highlights = Array.isArray(source.highlights) ? source.highlights.map((item) => this.normalizeHighlight(item, sourceSchemaVersion)).filter(Boolean) : [];
    return {
      highlights,
      cards_pending: Array.isArray(source.cards_pending) ? source.cards_pending : [],
      last_readwise_cursor: typeof source.last_readwise_cursor === "string" ? source.last_readwise_cursor : null,
      updatedAt: asString(source.updatedAt, nowIso()),
      schemaVersion: CURRENT_SCHEMA_VERSION
    };
  }
  normalizeHighlight(raw, sourceSchemaVersion) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const item = raw;
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
  async ensureParentFolder(path) {
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
};

// src/InboxView.ts
var import_obsidian2 = require("obsidian");

// src/WorkflowActions.ts
async function completeAtomicWorkflow(store, highlightId) {
  return store.setWorkflowStatus(highlightId, "atomic", "processed");
}
async function fetchReconcileAndRender(fetch2, reconcile, render) {
  await fetch2();
  await reconcile();
  render();
}

// src/ReflectResolution.ts
async function buildReflectIndexIfNeeded(highlightIds, build) {
  return highlightIds.length === 0 ? null : build();
}
async function buildReflectCandidateIndex(files, readCandidate, concurrency = 6) {
  var _a;
  const candidates = [];
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const index = next++;
      candidates[index] = await readCandidate(files[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, () => worker()));
  const unique = [...new Map(candidates.map((candidate) => [candidate.path, candidate])).values()];
  const candidatesByHighlightId = /* @__PURE__ */ new Map();
  const unreliableCandidates = [];
  for (const candidate of unique) {
    if (!candidate.reliable) unreliableCandidates.push(candidate);
    else if (candidate.id) candidatesByHighlightId.set(candidate.id, [...(_a = candidatesByHighlightId.get(candidate.id)) != null ? _a : [], candidate]);
  }
  return { candidatesByHighlightId, unreliableCandidates };
}
function resolveReflectFromIndex(index, highlightId) {
  var _a;
  const matches = (_a = index.candidatesByHighlightId.get(highlightId)) != null ? _a : [];
  if (matches.length > 1) return { kind: "ambiguous", files: matches.map((match) => match.file) };
  if (index.unreliableCandidates.length > 0) return { kind: "unresolved" };
  if (matches.length === 0) return { kind: "missing" };
  return { kind: "found", file: matches[0].file, reflected: matches[0].reflected === true };
}

// src/InboxView.ts
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
    this.confirmedReflectFiles = /* @__PURE__ */ new Set();
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
    await this.reconcileReflectNotes();
    this.render();
  }
  async reconcileReflectNotes() {
    this.confirmedReflectFiles.clear();
    const reflectHighlights = this.deps.stateStore.getState().highlights.filter((item) => hasRoute(item, "reflect"));
    const reflectIndex = await buildReflectIndexIfNeeded(reflectHighlights.map((highlight) => highlight.id), () => this.deps.reflectNotes.buildIndex());
    for (const highlight of reflectHighlights) {
      try {
        const resolution = this.deps.reflectNotes.resolveFromIndex(reflectIndex, highlight.id);
        if (isConfirmedReflectResolution(resolution.kind)) recordConfirmedReflectFile(this.confirmedReflectFiles, highlight.id);
        if (resolution.kind === "ambiguous") {
          new import_obsidian2.Notice(`Mehrere Reflect-Dateien f\xFCr Highlight ${highlight.id} gefunden.`);
          continue;
        }
        if (resolution.kind === "unresolved") continue;
        const file = resolution.kind === "found" ? resolution.file : null;
        const reconciledStatus = reconcileReflectStatus(highlight.workflow.reflect, resolution.kind === "found", resolution.kind === "found" && resolution.reflected);
        if (file) {
          const currentPath = (0, import_obsidian2.normalizePath)(highlight.workflow.reflectFilePath || "");
          const resolvedPath = (0, import_obsidian2.normalizePath)(file.path);
          if (shouldUpdateReflectFilePath(currentPath, resolvedPath)) await this.deps.stateStore.setReflectFilePath(highlight.id, resolvedPath);
        }
        if (reconciledStatus !== highlight.workflow.reflect) await this.deps.stateStore.setWorkflowStatus(highlight.id, "reflect", reconciledStatus);
      } catch (error) {
        new import_obsidian2.Notice(error instanceof Error ? error.message : "Reflect-Status konnte nicht abgeglichen werden.");
      }
    }
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
    count.textContent = `${highlights.length} Highlight${highlights.length === 1 ? "" : "s"} im Workflow`;
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
    meta.createSpan({ text: highlight.tags.length ? `Tags: ${highlight.tags.join(", ")}` : "Keine Workflow-Tags" });
    const workflow = card.createDiv({ cls: "rwi-workflows" });
    if (hasRoute(highlight, "atomic")) workflow.createSpan({ text: `Atomic: ${highlight.workflow.atomic}` });
    if (hasRoute(highlight, "reflect")) workflow.createSpan({ text: `Reflect: ${highlight.workflow.reflect}` });
    card.createEl("blockquote", { text: highlight.text, cls: "rwi-quote" });
    if (highlight.note) {
      const note = card.createDiv({ cls: "rwi-note" });
      note.createEl("strong", { text: "Note: " });
      note.appendText(highlight.note);
    }
    const actions = card.createDiv({ cls: "rwi-actions" });
    if (isMasteryAvailable(highlight)) actions.createEl("button", { text: "Mastery Card", cls: "rwi-button rwi-button-primary" }).addEventListener("click", () => this.openMastery(highlight));
    if (hasRoute(highlight, "atomic")) {
      if (highlight.workflow.atomic === "open") {
        actions.createEl("button", { text: "Atomic Note", cls: "rwi-button" }).addEventListener("click", () => this.openAtomic(highlight));
        actions.createEl("button", { text: "Atomic skip", cls: "rwi-button rwi-button-muted" }).addEventListener("click", () => this.skipRoute(highlight, "atomic"));
      }
    }
    if (hasRoute(highlight, "reflect")) {
      const reflectActions = reflectActionState(highlight, this.confirmedReflectFiles.has(highlight.id));
      for (const label of reflectButtonLabels(reflectActions)) {
        const button = actions.createEl("button", { text: label, cls: label === "Reflect skip" ? "rwi-button rwi-button-muted" : "rwi-button" });
        if (label === "Reflect \xF6ffnen") button.addEventListener("click", () => this.openReflect(highlight));
        else if (label === "Reflect skip") button.addEventListener("click", () => this.skipRoute(highlight, "reflect"));
        else button.addEventListener("click", () => this.toggleReflect(highlight));
      }
    }
    if (isMasteryAvailable(highlight)) actions.createEl("button", { text: "Skip", cls: "rwi-button rwi-button-muted" }).addEventListener("click", () => this.skip(highlight));
    return card;
  }
  async skipRoute(highlight, route) {
    await this.deps.stateStore.setWorkflowStatus(highlight.id, route, "skipped");
    new import_obsidian2.Notice(`${route === "atomic" ? "Atomic" : "Reflect"} geskippt.`);
    this.render();
  }
  async openReflect(highlight) {
    try {
      const { file, reflected } = await this.deps.reflectNotes.openOrCreate(highlight);
      recordConfirmedReflectFile(this.confirmedReflectFiles, highlight.id);
      await this.deps.stateStore.setReflectFilePath(highlight.id, file.path);
      await this.deps.stateStore.setWorkflowStatus(highlight.id, "reflect", reflected ? "processed" : "open");
      this.render();
    } catch (error) {
      new import_obsidian2.Notice(error instanceof Error ? error.message : "Reflect-Datei konnte nicht ge\xF6ffnet werden.");
    }
  }
  async toggleReflect(highlight) {
    try {
      const next = highlight.workflow.reflect !== "processed";
      const file = await this.deps.reflectNotes.setReflected(highlight, next);
      recordConfirmedReflectFile(this.confirmedReflectFiles, highlight.id);
      await this.deps.stateStore.setReflectFilePath(highlight.id, file.path);
      await this.deps.stateStore.setWorkflowStatus(highlight.id, "reflect", next ? "processed" : "open");
      this.render();
    } catch (error) {
      new import_obsidian2.Notice(error instanceof Error ? error.message : "Reflect-Status konnte nicht ge\xE4ndert werden.");
    }
  }
  async fetchReadwise() {
    try {
      await fetchReconcileAndRender(
        () => this.deps.readwiseApi.fetchHighlights(),
        () => this.reconcileReflectNotes(),
        () => this.render()
      );
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
      await completeAtomicWorkflow(this.deps.stateStore, highlight.id);
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
    // Export API highlight tags are objects with a `name`; document/book tags are
    // intentionally not inherited because they have different scope.
    tags: normalizeTags(item.tags),
    workflow: { atomic: "open", reflect: "open", reflectFilePath: "" },
    status: "inbox",
    loadedAt,
    updatedAt: loadedAt
  };
}

// src/ReadwisePagination.ts
async function collectReadwiseExportPages(requestPage) {
  let cursor = null;
  const seenCursors = /* @__PURE__ */ new Set();
  const byId = /* @__PURE__ */ new Map();
  do {
    const data = await requestPage(cursor);
    for (const highlight of flattenReadwiseExport(data)) byId.set(highlight.id, highlight);
    const next = getReadwiseCursor(data);
    if (next && seenCursors.has(next)) throw new Error(`Readwise lieferte den Cursor ${next} erneut; Fetch abgebrochen.`);
    if (next) seenCursors.add(next);
    cursor = next;
  } while (cursor);
  return [...byId.values()];
}
async function collectThenCommitReadwise(requestPage, commit) {
  const highlights = await collectReadwiseExportPages(requestPage);
  return commit(highlights);
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
    const counts = await collectThenCommitReadwise(async (cursor) => {
      const url = new URL(READWISE_EXPORT_ENDPOINT);
      if (cursor) url.searchParams.set("pageCursor", cursor);
      const response = await (0, import_obsidian3.requestUrl)({ url: url.toString(), method: "GET", headers: { Authorization: `Token ${token}` } });
      if (response.status < 200 || response.status >= 300) throw new Error(`Readwise Fetch fehlgeschlagen (${response.status}).`);
      return response.json;
    }, async (highlights) => {
      const result = this.stateStore.upsertHighlights(highlights);
      this.stateStore.setCursor(null);
      await this.stateStore.save();
      return result;
    });
    new import_obsidian3.Notice(`Readwise geladen: ${counts.added} neu, ${counts.updated} aktualisiert.`);
    return { ...counts, cursor: null };
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

// src/ReflectNoteService.ts
var import_obsidian5 = require("obsidian");

// src/ReflectMarkdown.ts
var yaml = (value) => JSON.stringify(value != null ? value : "");
var MAX_FILENAME_BYTES = 255;
var encoder = new TextEncoder();
var utf8ByteLength = (value) => encoder.encode(value).length;
function truncateUtf8(value, maxBytes) {
  let result = "";
  let bytes = 0;
  for (const codepoint of value) {
    const size = utf8ByteLength(codepoint);
    if (bytes + size > maxBytes) break;
    result += codepoint;
    bytes += size;
  }
  return result.replace(/\s+$/, "");
}
function reflectFilename(highlight) {
  const id = highlight.id.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
  const title = highlight.source_title.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || "Ohne Titel";
  const prefix = `Reflect \u2013 ${id} \u2013 `;
  const extension = ".md";
  const titleBudget = MAX_FILENAME_BYTES - utf8ByteLength(prefix) - utf8ByteLength(extension);
  if (titleBudget < 1) throw new Error(`Readwise-Highlight-ID ist zu lang f\xFCr einen Dateinamen mit maximal ${MAX_FILENAME_BYTES} UTF-8-Bytes.`);
  const filename = `${prefix}${truncateUtf8(title, titleBudget)}${extension}`;
  if (utf8ByteLength(filename) > MAX_FILENAME_BYTES) throw new Error("Reflect-Dateiname \xFCberschreitet das UTF-8-Bytelimit.");
  return filename;
}
function buildReflectMarkdown(highlight, createdAt = (/* @__PURE__ */ new Date()).toISOString()) {
  const title = highlight.source_title.trim() || "Ohne Titel";
  const quote = highlight.text.split(/\r?\n/).map((line) => `> ${line}`).join("\n");
  const readwiseNote = highlight.note.trim() || "_Keine Readwise-Notiz vorhanden._";
  return `---
type: readwise-reflection
workflow: reflect
reflected: false
reflected_at: ${yaml("")}
readwise_highlight_id: ${yaml(highlight.id)}
source_title: ${yaml(title)}
source_author: ${yaml(highlight.source_author)}
readwise_url: ${yaml(highlight.readwise_url)}
source_url: ${yaml(highlight.source_url)}
created_at: ${yaml(createdAt)}
---

# ${title}

## Zitat

${quote}

## Readwise-Notiz

${readwiseNote}

## Gedanken und Reflexion

`;
}

// src/ReflectNoteService.ts
var ReflectNoteService = class {
  constructor(app, getSettings) {
    this.app = app;
    this.getSettings = getSettings;
  }
  async openOrCreate(highlight) {
    const resolution = await this.resolve(highlight);
    if (resolution.kind === "ambiguous") throw new Error(`Mehrere Reflect-Dateien f\xFCr Highlight ${highlight.id} gefunden.`);
    if (resolution.kind === "unresolved") throw new Error("Reflect-Dateien konnten noch nicht zuverl\xE4ssig gepr\xFCft werden. Bitte erneut versuchen.");
    if (resolution.kind === "found") {
      await this.app.workspace.getLeaf("tab").openFile(resolution.file);
      return { file: resolution.file, created: false, reflected: resolution.reflected };
    }
    const folder = (0, import_obsidian5.normalizePath)(this.getSettings().reflectFolder || "Readwise Inbox/Reflect");
    await this.ensureFolder(folder);
    const path = (0, import_obsidian5.normalizePath)(`${folder}/${reflectFilename(highlight)}`);
    const collision = this.app.vault.getAbstractFileByPath(path);
    if (collision instanceof import_obsidian5.TFile) throw new Error(`Reflect-Datei ohne eindeutige Frontmatter existiert bereits: ${path}`);
    const file = await this.app.vault.create(path, buildReflectMarkdown(highlight));
    await this.app.workspace.getLeaf("tab").openFile(file);
    return { file, created: true, reflected: false };
  }
  async resolve(highlight) {
    return this.resolveFromIndex(await this.buildIndex(), highlight.id);
  }
  async buildIndex() {
    return buildReflectCandidateIndex(this.app.vault.getMarkdownFiles(), (file) => this.readCandidate(file));
  }
  resolveFromIndex(index, highlightId) {
    return resolveReflectFromIndex(index, highlightId);
  }
  async setReflected(highlight, reflected) {
    const resolution = await this.resolve(highlight);
    if (resolution.kind === "ambiguous") throw new Error(`Mehrere Reflect-Dateien f\xFCr Highlight ${highlight.id} gefunden.`);
    if (resolution.kind === "unresolved") throw new Error("Reflect-Dateien konnten noch nicht zuverl\xE4ssig gepr\xFCft werden. Bitte erneut versuchen.");
    if (resolution.kind === "missing") throw new Error("Reflect-Datei wurde nicht gefunden. Bitte zuerst erstellen.");
    const file = resolution.file;
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.reflected = reflected;
      frontmatter.reflected_at = reflected ? (/* @__PURE__ */ new Date()).toISOString() : "";
    });
    return file;
  }
  async readCandidate(file) {
    try {
      const cache = this.app.metadataCache.getFileCache(file);
      let frontmatter = cache == null ? void 0 : cache.frontmatter;
      if (!frontmatter) {
        const content = await this.app.vault.cachedRead(file);
        const info = (0, import_obsidian5.getFrontMatterInfo)(content);
        frontmatter = info.exists ? (0, import_obsidian5.parseYaml)(info.frontmatter) : {};
      }
      const id = frontmatter == null ? void 0 : frontmatter.readwise_highlight_id;
      return { file, path: file.path, id: id == null ? void 0 : String(id), reflected: (frontmatter == null ? void 0 : frontmatter.reflected) === true, reliable: true };
    } catch (e) {
      return { file, path: file.path, reliable: false };
    }
  }
  async ensureFolder(folder) {
    let current = "";
    for (const part of folder.split("/").filter(Boolean)) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }
};

// src/main.ts
var import_obsidian7 = require("obsidian");
var DEFAULT_SETTINGS = {
  readwiseToken: "",
  masteryDeck: "Mastery",
  memriseDeck: "Memrise",
  statePath: "readwise-inbox.json",
  zettelFolder: "",
  reflectFolder: "Readwise Inbox/Reflect"
};
var ReadwiseInboxPlugin = class extends import_obsidian6.Plugin {
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
    this.reflectNotes = new ReflectNoteService(this.app, () => this.settings);
    this.registerView(VIEW_TYPE_READWISE_INBOX, (leaf) => new InboxView(leaf, {
      stateStore: this.stateStore,
      readwiseApi: this.readwiseApi,
      anki: this.anki,
      zettelCreator: this.zettelCreator,
      reflectNotes: this.reflectNotes,
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
      new import_obsidian6.Notice(`AnkiConnect verbunden (Version ${version}).`);
    } catch (error) {
      new import_obsidian6.Notice(error instanceof Error ? `AnkiConnect nicht erreichbar: ${error.message}` : "AnkiConnect nicht erreichbar.");
    }
  }
};
var ReadwiseInboxSettingTab = class extends import_obsidian6.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("rwi-settings");
    containerEl.createEl("h2", { text: "Readwise Inbox Einstellungen" });
    new import_obsidian6.Setting(containerEl).setName("Readwise API Token").setDesc("Token wird lokal in den Obsidian Plugin-Daten gespeichert und nicht ins Repository geschrieben.").addText((text) => {
      text.inputEl.type = "password";
      text.setPlaceholder("Readwise Token").setValue(this.plugin.settings.readwiseToken).onChange(async (value) => {
        this.plugin.settings.readwiseToken = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian6.Setting(containerEl).setName("Mastery Deck").addText((text) => text.setValue(this.plugin.settings.masteryDeck).onChange(async (value) => {
      this.plugin.settings.masteryDeck = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian6.Setting(containerEl).setName("Memrise Deck").setDesc("Sprint 1 legt nur die Settings und Modellkonstanten an; kein vollst\xE4ndiger Memrise-Flow.").addText((text) => text.setValue(this.plugin.settings.memriseDeck).onChange(async (value) => {
      this.plugin.settings.memriseDeck = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian6.Setting(containerEl).setName("State-Dateipfad").setDesc("Default: readwise-inbox.json").addText((text) => text.setValue(this.plugin.settings.statePath).onChange(async (value) => {
      this.plugin.settings.statePath = value.trim() || "readwise-inbox.json";
      await this.plugin.saveSettings();
      await this.plugin.stateStore.load();
    }));
    new import_obsidian6.Setting(containerEl).setName("Zettel-Zielordner").setDesc("Leer lassen f\xFCr Vault-Root.").addText((text) => text.setPlaceholder("z.B. Zettel").setValue(this.plugin.settings.zettelFolder).onChange(async (value) => {
      this.plugin.settings.zettelFolder = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian6.Setting(containerEl).setName("Ordner f\xFCr Reflexionsnotizen").setDesc("Relativ zum Vault-Root. Default: Readwise Inbox/Reflect").addText((text) => text.setValue(this.plugin.settings.reflectFolder).onChange(async (value) => {
      const normalized = (0, import_obsidian7.normalizePath)(value.trim() || "Readwise Inbox/Reflect");
      this.plugin.settings.reflectFolder = normalized.startsWith("/") ? normalized.slice(1) : normalized;
      await this.plugin.saveSettings();
    }));
    new import_obsidian6.Setting(containerEl).setName("AnkiConnect").setDesc("Testet http://localhost:8765").addButton((button) => button.setButtonText("Verbindung testen").onClick(() => this.plugin.testAnki()));
  }
};
