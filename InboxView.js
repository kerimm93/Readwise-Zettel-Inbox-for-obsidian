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
