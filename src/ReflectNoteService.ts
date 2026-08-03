import { App, normalizePath, TFile } from "obsidian";
import { buildReflectMarkdown, reflectFilename } from "./ReflectMarkdown";
import type { Highlight, PluginSettings } from "./types";

export class ReflectNoteService {
  constructor(private app: App, private getSettings: () => PluginSettings) {}

  async openOrCreate(highlight: Highlight): Promise<{ file: TFile; created: boolean }> {
    const existing = this.find(highlight);
    if (existing) {
      await this.app.workspace.getLeaf("tab").openFile(existing);
      return { file: existing, created: false };
    }
    const folder = normalizePath(this.getSettings().reflectFolder || "Readwise Inbox/Reflect");
    await this.ensureFolder(folder);
    const path = normalizePath(`${folder}/${reflectFilename(highlight)}`);
    const collision = this.app.vault.getAbstractFileByPath(path);
    if (collision instanceof TFile) throw new Error(`Reflect-Datei ohne eindeutige Frontmatter existiert bereits: ${path}`);
    const file = await this.app.vault.create(path, buildReflectMarkdown(highlight));
    await this.app.workspace.getLeaf("tab").openFile(file);
    return { file, created: true };
  }

  find(highlight: Highlight): TFile | null {
    const cached = this.app.vault.getAbstractFileByPath(normalizePath(highlight.workflow.reflectFilePath));
    if (cached instanceof TFile && this.fileId(cached) === highlight.id) return cached;
    const matches = this.app.vault.getMarkdownFiles().filter((file) => this.fileId(file) === highlight.id);
    if (matches.length > 1) throw new Error(`Mehrere Reflect-Dateien für Highlight ${highlight.id} gefunden.`);
    return matches[0] ?? null;
  }

  reflected(file: TFile): boolean {
    return this.app.metadataCache.getFileCache(file)?.frontmatter?.reflected === true;
  }

  async setReflected(highlight: Highlight, reflected: boolean): Promise<TFile> {
    const file = this.find(highlight);
    if (!file) throw new Error("Reflect-Datei wurde nicht gefunden. Bitte zuerst erstellen.");
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.reflected = reflected;
      frontmatter.reflected_at = reflected ? new Date().toISOString() : "";
    });
    return file;
  }

  private fileId(file: TFile): string {
    const value = this.app.metadataCache.getFileCache(file)?.frontmatter?.readwise_highlight_id;
    return value == null ? "" : String(value);
  }

  private async ensureFolder(folder: string): Promise<void> {
    let current = "";
    for (const part of folder.split("/").filter(Boolean)) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }
}
