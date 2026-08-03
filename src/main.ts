import { Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from "obsidian";
import { AnkiConnect } from "./AnkiConnect";
import { InboxStateStore } from "./InboxState";
import { InboxView, VIEW_TYPE_READWISE_INBOX } from "./InboxView";
import { ReadwiseApi } from "./ReadwiseApi";
import { PluginSettings } from "./types";
import { ZettelCreator } from "./ZettelCreator";
import { ReflectNoteService } from "./ReflectNoteService";
import { normalizePath } from "obsidian";

const DEFAULT_SETTINGS: PluginSettings = {
  readwiseToken: "",
  masteryDeck: "Mastery",
  memriseDeck: "Memrise",
  statePath: "readwise-inbox.json",
  zettelFolder: "",
  reflectFolder: "Readwise Inbox/Reflect"
};

export default class ReadwiseInboxPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  stateStore!: InboxStateStore;
  readwiseApi!: ReadwiseApi;
  anki!: AnkiConnect;
  zettelCreator!: ZettelCreator;
  reflectNotes!: ReflectNoteService;

  async onload(): Promise<void> {
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

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_READWISE_INBOX);
  }

  async activateView(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_READWISE_INBOX);
    let leaf: WorkspaceLeaf;
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_READWISE_INBOX, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async testAnki(): Promise<void> {
    try {
      const version = await this.anki.testConnection();
      new Notice(`AnkiConnect verbunden (Version ${version}).`);
    } catch (error) {
      new Notice(error instanceof Error ? `AnkiConnect nicht erreichbar: ${error.message}` : "AnkiConnect nicht erreichbar.");
    }
  }
}

class ReadwiseInboxSettingTab extends PluginSettingTab {
  constructor(app: import("obsidian").App, public plugin: ReadwiseInboxPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("rwi-settings");
    containerEl.createEl("h2", { text: "Readwise Inbox Einstellungen" });

    new Setting(containerEl)
      .setName("Readwise API Token")
      .setDesc("Token wird lokal in den Obsidian Plugin-Daten gespeichert und nicht ins Repository geschrieben.")
      .addText((text) => {
        text.inputEl.type = "password";
        text.setPlaceholder("Readwise Token").setValue(this.plugin.settings.readwiseToken).onChange(async (value) => {
          this.plugin.settings.readwiseToken = value.trim();
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Mastery Deck")
      .addText((text) => text.setValue(this.plugin.settings.masteryDeck).onChange(async (value) => {
        this.plugin.settings.masteryDeck = value;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("Memrise Deck")
      .setDesc("Sprint 1 legt nur die Settings und Modellkonstanten an; kein vollständiger Memrise-Flow.")
      .addText((text) => text.setValue(this.plugin.settings.memriseDeck).onChange(async (value) => {
        this.plugin.settings.memriseDeck = value;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("State-Dateipfad")
      .setDesc("Default: readwise-inbox.json")
      .addText((text) => text.setValue(this.plugin.settings.statePath).onChange(async (value) => {
        this.plugin.settings.statePath = value.trim() || "readwise-inbox.json";
        await this.plugin.saveSettings();
        await this.plugin.stateStore.load();
      }));

    new Setting(containerEl)
      .setName("Zettel-Zielordner")
      .setDesc("Leer lassen für Vault-Root.")
      .addText((text) => text.setPlaceholder("z.B. Zettel").setValue(this.plugin.settings.zettelFolder).onChange(async (value) => {
        this.plugin.settings.zettelFolder = value.trim();
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("Ordner für Reflexionsnotizen")
      .setDesc("Relativ zum Vault-Root. Default: Readwise Inbox/Reflect")
      .addText((text) => text.setValue(this.plugin.settings.reflectFolder).onChange(async (value) => {
        const normalized = normalizePath(value.trim() || "Readwise Inbox/Reflect");
        this.plugin.settings.reflectFolder = normalized.startsWith("/") ? normalized.slice(1) : normalized;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("AnkiConnect")
      .setDesc("Testet http://localhost:8765")
      .addButton((button) => button.setButtonText("Verbindung testen").onClick(() => this.plugin.testAnki()));
  }
}
