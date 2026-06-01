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
    const parts = [];
    if (highlight.source_cover) {
        parts.push(`<img src="${escapeHtml(highlight.source_cover)}" alt="Cover">`);
    }
    if (highlight.source_url) {
        parts.push(`<a href="${escapeHtml(highlight.source_url)}">Quelle</a>`);
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
