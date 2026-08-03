import type { Highlight } from "./types.ts";

const yaml = (value: string): string => JSON.stringify(value ?? "");

export function reflectFilename(highlight: Pick<Highlight, "id" | "source_title">): string {
  const id = highlight.id.replace(/[\\/:*?"<>|]/g, "-").trim();
  const title = highlight.source_title.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || "Ohne Titel";
  return `Reflect – ${id} – ${title.slice(0, 100).trim()}.md`;
}

export function buildReflectMarkdown(highlight: Highlight, createdAt = new Date().toISOString()): string {
  const title = highlight.source_title.trim() || "Ohne Titel";
  const quote = highlight.text.split(/\r?\n/).map((line) => `> ${line}`).join("\n");
  const readwiseNote = highlight.note.trim() || "_Keine Readwise-Notiz vorhanden._";
  return `---\ntype: readwise-reflection\nworkflow: reflect\nreflected: false\nreflected_at: ${yaml("")}\nreadwise_highlight_id: ${yaml(highlight.id)}\nsource_title: ${yaml(title)}\nsource_author: ${yaml(highlight.source_author)}\nreadwise_url: ${yaml(highlight.readwise_url)}\nsource_url: ${yaml(highlight.source_url)}\ncreated_at: ${yaml(createdAt)}\n---\n\n# ${title}\n\n## Zitat\n\n${quote}\n\n## Readwise-Notiz\n\n${readwiseNote}\n\n## Gedanken und Reflexion\n\n`;
}
