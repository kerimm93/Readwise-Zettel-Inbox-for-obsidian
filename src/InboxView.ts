import { ItemView, Modal, Notice, Setting, WorkspaceLeaf } from "obsidian";
import { AnkiConnect, buildMedienFeld, buildZitatFeld } from "./AnkiConnect";
import { InboxStateStore } from "./InboxState";
import { ReadwiseApi } from "./ReadwiseApi";
import { Highlight, PluginSettings } from "./types";
import { ZettelCreator } from "./ZettelCreator";

export const VIEW_TYPE_READWISE_INBOX = "readwise-inbox-view";

export interface InboxViewDeps {
  stateStore: InboxStateStore;
  readwiseApi: ReadwiseApi;
  anki: AnkiConnect;
  zettelCreator: ZettelCreator;
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
    this.render();
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

  private renderHighlight(highlight: Highlight): HTMLElement {
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

  private async fetchReadwise(): Promise<void> {
    try {
      await this.deps.readwiseApi.fetchHighlights();
      this.render();
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
      await this.deps.stateStore.setStatus(highlight.id, "processed");
      new Notice("Atomic Note erstellt.");
      this.render();
    });
  }
}
