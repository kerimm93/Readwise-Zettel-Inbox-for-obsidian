import { ItemView, Modal, normalizePath, Notice, Setting, WorkspaceLeaf } from "obsidian";
import { AnkiConnect, buildMedienFeld, buildZitatFeld } from "./AnkiConnect";
import { InboxStateStore } from "./InboxState";
import { ReadwiseApi } from "./ReadwiseApi";
import { Highlight, PluginSettings } from "./types";
import { ZettelCreator } from "./ZettelCreator";
import { ReflectNoteService } from "./ReflectNoteService";
import { hasRoute, isConfirmedReflectResolution, isMasteryAvailable, reconcileReflectStatus, recordConfirmedReflectFile, reflectActionState, reflectButtonLabels, shouldUpdateReflectFilePath } from "./WorkflowRouting";
import { completeAtomicWorkflow, fetchReconcileAndRender } from "./WorkflowActions";
import { buildReflectIndexIfNeeded } from "./ReflectResolution";

export const VIEW_TYPE_READWISE_INBOX = "readwise-inbox-view";

export interface InboxViewDeps {
  stateStore: InboxStateStore;
  readwiseApi: ReadwiseApi;
  anki: AnkiConnect;
  zettelCreator: ZettelCreator;
  reflectNotes: ReflectNoteService;
  getSettings: () => PluginSettings;
}

class MasteryModal extends Modal {
  private frage = "";
  private antwort = "";
  private notizen: string;

  constructor(app: import("obsidian").App, private highlight: Highlight, private onSubmit: (frage: string, antwort: string, notizen: string) => Promise<void>) {
    super(app);
    this.notizen = highlight.note;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("rwi-modal");
    contentEl.createEl("h2", { text: "Mastery Card" });

    new Setting(contentEl)
      .setName("Frage")
      .addTextArea((text) => text.setPlaceholder("Frage").setValue(this.frage).onChange((value) => { this.frage = value; }));

    new Setting(contentEl)
      .setName("Antwort")
      .addTextArea((text) => text.setPlaceholder("Antwort").setValue(this.antwort).onChange((value) => { this.antwort = value; }));

    const quote = contentEl.createDiv({ cls: "rwi-readonly" });
    quote.createEl("strong", { text: "Zitat" });
    quote.createDiv().innerHTML = buildZitatFeld(this.highlight);

    new Setting(contentEl)
      .setName("Notizen")
      .addTextArea((text) => text.setValue(this.notizen).onChange((value) => { this.notizen = value; }));

    const media = contentEl.createDiv({ cls: "rwi-readonly" });
    media.createEl("strong", { text: "Medien" });
    media.createDiv().innerHTML = buildMedienFeld(this.highlight) || "—";

    new Setting(contentEl)
      .addButton((button) => button.setButtonText("An Anki senden").setCta().onClick(async () => {
        if (!this.frage.trim() || !this.antwort.trim()) {
          new Notice("Frage und Antwort sind erforderlich.");
          return;
        }
        await this.onSubmit(this.frage, this.antwort, this.notizen);
        this.close();
      }));
  }
}

export class InboxView extends ItemView {
  private confirmedReflectFiles = new Set<string>();

  constructor(leaf: WorkspaceLeaf, private deps: InboxViewDeps) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_READWISE_INBOX;
  }

  getDisplayText(): string {
    return "Readwise Inbox";
  }

  getIcon(): string {
    return "inbox";
  }

  async onOpen(): Promise<void> {
    await this.deps.stateStore.load();
    await this.reconcileReflectNotes();
    this.render();
  }

  private async reconcileReflectNotes(): Promise<void> {
    this.confirmedReflectFiles.clear();
    const reflectHighlights = this.deps.stateStore.getState().highlights.filter((item) => hasRoute(item, "reflect"));
    const reflectIndex = await buildReflectIndexIfNeeded(reflectHighlights.map((highlight) => highlight.id), () => this.deps.reflectNotes.buildIndex());
    for (const highlight of reflectHighlights) {
      try {
        const resolution = this.deps.reflectNotes.resolveFromIndex(reflectIndex!, highlight.id);
        if (isConfirmedReflectResolution(resolution.kind)) recordConfirmedReflectFile(this.confirmedReflectFiles, highlight.id);
        if (resolution.kind === "ambiguous") {
          new Notice(`Mehrere Reflect-Dateien für Highlight ${highlight.id} gefunden.`);
          continue;
        }
        if (resolution.kind === "unresolved") continue;
        const file = resolution.kind === "found" ? resolution.file : null;
        const reconciledStatus = reconcileReflectStatus(highlight.workflow.reflect, resolution.kind === "found", resolution.kind === "found" && resolution.reflected);
        if (file) {
          const currentPath = normalizePath(highlight.workflow.reflectFilePath || "");
          const resolvedPath = normalizePath(file.path);
          if (shouldUpdateReflectFilePath(currentPath, resolvedPath)) await this.deps.stateStore.setReflectFilePath(highlight.id, resolvedPath);
        }
        if (reconciledStatus !== highlight.workflow.reflect) await this.deps.stateStore.setWorkflowStatus(highlight.id, "reflect", reconciledStatus);
      } catch (error) { new Notice(error instanceof Error ? error.message : "Reflect-Status konnte nicht abgeglichen werden."); }
    }
  }

  render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
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
    count.textContent = `${highlights.length} Highlight${highlights.length === 1 ? "" : "s"} im Workflow`;

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

  private renderHighlight(highlight: Highlight): HTMLElement {
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
        if (label === "Reflect öffnen") button.addEventListener("click", () => this.openReflect(highlight));
        else if (label === "Reflect skip") button.addEventListener("click", () => this.skipRoute(highlight, "reflect"));
        else button.addEventListener("click", () => this.toggleReflect(highlight));
      }
    }
    if (isMasteryAvailable(highlight)) actions.createEl("button", { text: "Skip", cls: "rwi-button rwi-button-muted" }).addEventListener("click", () => this.skip(highlight));
    return card;
  }

  private async skipRoute(highlight: Highlight, route: "atomic" | "reflect"): Promise<void> {
    await this.deps.stateStore.setWorkflowStatus(highlight.id, route, "skipped");
    new Notice(`${route === "atomic" ? "Atomic" : "Reflect"} geskippt.`);
    this.render();
  }

  private async openReflect(highlight: Highlight): Promise<void> {
    try {
      const { file, reflected } = await this.deps.reflectNotes.openOrCreate(highlight);
      recordConfirmedReflectFile(this.confirmedReflectFiles, highlight.id);
      await this.deps.stateStore.setReflectFilePath(highlight.id, file.path);
      await this.deps.stateStore.setWorkflowStatus(highlight.id, "reflect", reflected ? "processed" : "open");
      this.render();
    } catch (error) { new Notice(error instanceof Error ? error.message : "Reflect-Datei konnte nicht geöffnet werden."); }
  }

  private async toggleReflect(highlight: Highlight): Promise<void> {
    try {
      const next = highlight.workflow.reflect !== "processed";
      const file = await this.deps.reflectNotes.setReflected(highlight, next);
      recordConfirmedReflectFile(this.confirmedReflectFiles, highlight.id);
      await this.deps.stateStore.setReflectFilePath(highlight.id, file.path);
      await this.deps.stateStore.setWorkflowStatus(highlight.id, "reflect", next ? "processed" : "open");
      this.render();
    } catch (error) { new Notice(error instanceof Error ? error.message : "Reflect-Status konnte nicht geändert werden."); }
  }

  private async fetchReadwise(): Promise<void> {
    try {
      await fetchReconcileAndRender(
        () => this.deps.readwiseApi.fetchHighlights(),
        () => this.reconcileReflectNotes(),
        () => this.render()
      );
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "Readwise Fetch fehlgeschlagen.");
    }
  }

  private async skip(highlight: Highlight): Promise<void> {
    await this.deps.stateStore.setStatus(highlight.id, "skipped");
    new Notice("Highlight geskippt.");
    this.render();
  }

  private openMastery(highlight: Highlight): void {
    new MasteryModal(this.app, highlight, async (frage, antwort, notizen) => {
      try {
        await this.deps.anki.addMasteryNote(this.deps.getSettings().masteryDeck, highlight, { frage, antwort, notizen });
        await this.deps.stateStore.setStatus(highlight.id, "processed");
        new Notice("Mastery Card an Anki gesendet.");
        this.render();
      } catch (error) {
        new Notice(error instanceof Error ? `Anki Fehler: ${error.message}` : "Anki Fehler.");
      }
    }).open();
  }

  private openAtomic(highlight: Highlight): void {
    this.deps.zettelCreator.openCreateModal(highlight, async () => {
      await completeAtomicWorkflow(this.deps.stateStore, highlight.id);
      new Notice("Atomic Note erstellt.");
      this.render();
    });
  }
}
