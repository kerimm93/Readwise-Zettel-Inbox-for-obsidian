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
            await this.onSubmit({ parent: this.parent, kuerzel: this.kuerzel, title: this.title, desc: this.desc, note: this.note });
            this.close();
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
