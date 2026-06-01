import { App, FuzzySuggestModal, Modal, Notice, normalizePath, Setting, TFile } from "obsidian";
import { Highlight, PluginSettings } from "./types";

export interface ParentCandidate {
  title: string;
  path: string;
  basename: string;
}

export interface AtomicNoteInput {
  parent: ParentCandidate;
  kuerzel: string;
  title: string;
  desc: string;
  note: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function cleanSegment(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, "-");
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

export class ParentSuggestModal extends FuzzySuggestModal<ParentCandidate> {
  constructor(app: App, private onChoose: (candidate: ParentCandidate) => void) {
    super(app);
    this.setPlaceholder("Parent-Note nach title-Frontmatter oder Dateiname suchen...");
  }

  getItems(): ParentCandidate[] {
    return this.app.vault.getMarkdownFiles().map((file) => {
      const cache = this.app.metadataCache.getFileCache(file);
      const title = typeof cache?.frontmatter?.title === "string" ? cache.frontmatter.title : file.basename;
      return { title, path: file.path, basename: file.basename };
    });
  }

  getItemText(item: ParentCandidate): string {
    return `${item.title} — ${item.path}`;
  }

  onChooseItem(item: ParentCandidate): void {
    this.onChoose(item);
  }
}

export class AtomicNoteModal extends Modal {
  private parent: ParentCandidate | null = null;
  private kuerzel = "";
  private title = "";
  private desc = "";
  private note = "";

  constructor(app: App, private highlight: Highlight, private onSubmit: (input: AtomicNoteInput) => Promise<void>) {
    super(app);
    this.title = highlight.text.slice(0, 80).replace(/\s+/g, " ").trim();
    this.desc = highlight.source_title;
    this.note = highlight.note;
  }

  onOpen(): void {
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("rwi-modal");
    contentEl.createEl("h2", { text: "Atomic Note erstellen" });

    new Setting(contentEl)
      .setName("Parent")
      .setDesc(this.parent ? `${this.parent.title} (${this.parent.path})` : "Parent per Fuzzy Search auswählen")
      .addButton((button) => button.setButtonText("Parent suchen").onClick(() => {
        new ParentSuggestModal(this.app, (candidate) => {
          this.parent = candidate;
          this.render();
        }).open();
      }));

    new Setting(contentEl)
      .setName("Kürzel")
      .setDesc("Dateiname wird <parent-basename>.<k>.md")
      .addText((text) => text.setPlaceholder("k").setValue(this.kuerzel).onChange((value) => { this.kuerzel = value; }));

    new Setting(contentEl)
      .setName("Titel")
      .addTextArea((text) => text.setValue(this.title).onChange((value) => { this.title = value; }));

    new Setting(contentEl)
      .setName("Beschreibung")
      .addText((text) => text.setValue(this.desc).onChange((value) => { this.desc = value; }));

    new Setting(contentEl)
      .setName("Notiz")
      .addTextArea((text) => text.setValue(this.note).onChange((value) => { this.note = value; }));

    contentEl.createEl("blockquote", { text: this.highlight.text });

    new Setting(contentEl)
      .addButton((button) => button.setButtonText("Erstellen").setCta().onClick(async () => {
        if (!this.parent) {
          new Notice("Bitte zuerst eine Parent-Note auswählen.");
          return;
        }
        if (!this.kuerzel.trim()) {
          new Notice("Bitte ein Kürzel eingeben.");
          return;
        }
        await this.onSubmit({ parent: this.parent, kuerzel: this.kuerzel, title: this.title, desc: this.desc, note: this.note });
        this.close();
      }));
  }
}

export class ZettelCreator {
  constructor(private app: App, private getSettings: () => PluginSettings) {}

  openCreateModal(highlight: Highlight, onCreated: (file: TFile) => Promise<void>): void {
    new AtomicNoteModal(this.app, highlight, async (input) => {
      const file = await this.createAtomicNote(highlight, input);
      await onCreated(file);
    }).open();
  }

  async createAtomicNote(highlight: Highlight, input: AtomicNoteInput): Promise<TFile> {
    const folder = normalizePath(this.getSettings().zettelFolder || "");
    if (folder) {
      await this.ensureFolder(folder);
    }

    const filename = `${input.parent.basename}.${cleanSegment(input.kuerzel)}.md`;
    const path = normalizePath(folder ? `${folder}/${filename}` : filename);
    if (this.app.vault.getAbstractFileByPath(path)) {
      throw new Error(`Datei existiert bereits: ${path}`);
    }

    const markdown = this.buildMarkdown(highlight, input);
    const file = await this.app.vault.create(path, markdown);
    await this.app.workspace.getLeaf("tab").openFile(file);
    return file;
  }

  buildMarkdown(highlight: Highlight, input: AtomicNoteInput): string {
    return `---\ntitle: ${yamlString(input.title)}\nalias: ${yamlString(input.title)}\ndesc: ${yamlString(input.desc)}\ntags:\n  - proto-atomic\ncreated: ${today()}\nrwi_source: readwise\n---\n\n# ${input.title}\n\n${input.note}\n\n## 📖 Quelle\n\n„${highlight.text}"\n(${highlight.source_author}, ${highlight.source_title})\n[📖 Original in Readwise](${highlight.readwise_url})\n`;
  }

  private async ensureFolder(folder: string): Promise<void> {
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
