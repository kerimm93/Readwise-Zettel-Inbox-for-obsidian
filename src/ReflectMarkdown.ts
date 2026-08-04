import type { Highlight } from "./types.ts";

const yaml = (value: string): string => JSON.stringify(value ?? "");
export const MAX_FILENAME_BYTES = 255;
const encoder = new TextEncoder();

export const utf8ByteLength = (value: string): number => encoder.encode(value).length;

export function truncateUtf8(value: string, maxBytes: number): string {
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

export function reflectFilename(highlight: Pick<Highlight, "id" | "source_title">): string {
  const id = highlight.id.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
  const title = highlight.source_title.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || "Ohne Titel";
  const prefix = `Reflect – ${id} – `;
  const extension = ".md";
  const titleBudget = MAX_FILENAME_BYTES - utf8ByteLength(prefix) - utf8ByteLength(extension);
  if (titleBudget < 1) throw new Error(`Readwise-Highlight-ID ist zu lang für einen Dateinamen mit maximal ${MAX_FILENAME_BYTES} UTF-8-Bytes.`);
  const filename = `${prefix}${truncateUtf8(title, titleBudget)}${extension}`;
  if (utf8ByteLength(filename) > MAX_FILENAME_BYTES) throw new Error("Reflect-Dateiname überschreitet das UTF-8-Bytelimit.");
  return filename;
}

export function buildReflectMarkdown(highlight: Highlight, createdAt = new Date().toISOString()): string {
  const title = highlight.source_title.trim() || "Ohne Titel";
  const quote = highlight.text.split(/\r?\n/).map((line) => `> ${line}`).join("\n");
  const readwiseNote = highlight.note.trim() || "_Keine Readwise-Notiz vorhanden._";
  return `---\ntype: readwise-reflection\nworkflow: reflect\nreflected: false\nreflected_at: ${yaml("")}\nreadwise_highlight_id: ${yaml(highlight.id)}\nsource_title: ${yaml(title)}\nsource_author: ${yaml(highlight.source_author)}\nreadwise_url: ${yaml(highlight.readwise_url)}\nsource_url: ${yaml(highlight.source_url)}\ncreated_at: ${yaml(createdAt)}\n---\n\n# ${title}\n\n## Zitat\n\n${quote}\n\n## Readwise-Notiz\n\n${readwiseNote}\n\n## Gedanken und Reflexion\n\n`;
}
