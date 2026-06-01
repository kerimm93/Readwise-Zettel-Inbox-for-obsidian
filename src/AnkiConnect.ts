import { Highlight } from "./types";

export const ANKI_CONNECT_ENDPOINT = "http://localhost:8765";

export const MODELS = {
  mastery: "Mastery-Notiztyp",
  mc: "Memrise (Lτ) Preset [Translation+Listenting | MultipleChoice+Typing] v5.1",
  tapping: "Memrise (Lτ) Preset [Translation+Listenting | Tapping+Typing] v5.1",
  cloze: "Memrise (Lτ) Cloze Template v5.1"
} as const;

export interface MasteryInput {
  frage: string;
  antwort: string;
  notizen: string;
}

export interface AnkiNote {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  options: { allowDuplicate: boolean };
  tags: string[];
}

interface AnkiResponse<T> {
  result: T;
  error: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildMedienFeld(highlight: Highlight): string {
  const parts: string[] = [];
  if (highlight.source_cover) {
    parts.push(`<img src="${escapeHtml(highlight.source_cover)}" alt="Cover">`);
  }
  if (highlight.source_url) {
    parts.push(`<a href="${escapeHtml(highlight.source_url)}">Quelle</a>`);
  }
  return parts.join("<br>");
}

export function buildZitatFeld(highlight: Highlight): string {
  return `„${escapeHtml(highlight.text)}" (${escapeHtml(highlight.source_author)}, ${escapeHtml(highlight.source_title)}) <a href="${escapeHtml(highlight.readwise_url)}">📖 Readwise</a>`;
}

export class AnkiConnect {
  async ankiRequest<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(ANKI_CONNECT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: 6, params })
    });

    if (!response.ok) {
      throw new Error(`AnkiConnect HTTP ${response.status}`);
    }

    const payload = await response.json() as AnkiResponse<T>;
    if (payload.error) {
      throw new Error(payload.error);
    }
    return payload.result;
  }

  async testConnection(): Promise<string> {
    return this.ankiRequest<string>("version");
  }

  buildMasteryNote(deckName: string, highlight: Highlight, input: MasteryInput): AnkiNote {
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

  async addMasteryNote(deckName: string, highlight: Highlight, input: MasteryInput): Promise<number> {
    const note = this.buildMasteryNote(deckName, highlight, input);
    return this.ankiRequest<number>("addNote", { note });
  }
}
