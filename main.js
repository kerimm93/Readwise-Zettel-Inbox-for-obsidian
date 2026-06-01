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
