import { App, getFrontMatterInfo, normalizePath, parseYaml, TFile } from "obsidian";
import { buildReflectMarkdown, reflectFilename } from "./ReflectMarkdown";
import { classifyReflectCandidates, ReflectCandidate, ReflectFileResolution } from "./ReflectResolution";
import type { Highlight, PluginSettings } from "./types";

export class ReflectNoteService {
  constructor(private app: App, private getSettings: () => PluginSettings) {}

  async openOrCreate(highlight: Highlight): Promise<{ file: TFile; created: boolean; reflected: boolean }> {
    const resolution = await this.resolve(highlight);
    if (resolution.kind === "ambiguous") throw new Error(`Mehrere Reflect-Dateien für Highlight ${highlight.id} gefunden.`);
    if (resolution.kind === "unresolved") throw new Error("Reflect-Dateien konnten noch nicht zuverlässig geprüft werden. Bitte erneut versuchen.");
    if (resolution.kind === "found") {
      await this.app.workspace.getLeaf("tab").openFile(resolution.file);
      return { file: resolution.file, created: false, reflected: resolution.reflected };
    }
    const folder = normalizePath(this.getSettings().reflectFolder || "Readwise Inbox/Reflect");
    await this.ensureFolder(folder);
    const path = normalizePath(`${folder}/${reflectFilename(highlight)}`);
    const collision = this.app.vault.getAbstractFileByPath(path);
    if (collision instanceof TFile) throw new Error(`Reflect-Datei ohne eindeutige Frontmatter existiert bereits: ${path}`);
    const file = await this.app.vault.create(path, buildReflectMarkdown(highlight));
    await this.app.workspace.getLeaf("tab").openFile(file);
    return { file, created: true, reflected: false };
  }

  async resolve(highlight: Highlight): Promise<ReflectFileResolution<TFile>> {
    const cachedPath = normalizePath(highlight.workflow.reflectFilePath || "");
    const files = this.app.vault.getMarkdownFiles().slice().sort((a, b) => Number(b.path === cachedPath) - Number(a.path === cachedPath));
    const candidates = await Promise.all(files.map((file) => this.readCandidate(file)));
    return classifyReflectCandidates(candidates, highlight.id);
  }

  async setReflected(highlight: Highlight, reflected: boolean): Promise<TFile> {
    const resolution = await this.resolve(highlight);
    if (resolution.kind === "ambiguous") throw new Error(`Mehrere Reflect-Dateien für Highlight ${highlight.id} gefunden.`);
    if (resolution.kind === "unresolved") throw new Error("Reflect-Dateien konnten noch nicht zuverlässig geprüft werden. Bitte erneut versuchen.");
    if (resolution.kind === "missing") throw new Error("Reflect-Datei wurde nicht gefunden. Bitte zuerst erstellen.");
    const file = resolution.file;
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.reflected = reflected;
      frontmatter.reflected_at = reflected ? new Date().toISOString() : "";
    });
    return file;
  }

  private async readCandidate(file: TFile): Promise<ReflectCandidate<TFile>> {
    try {
      const cache = this.app.metadataCache.getFileCache(file);
      let frontmatter = cache?.frontmatter;
      if (!frontmatter) {
        const content = await this.app.vault.cachedRead(file);
        const info = getFrontMatterInfo(content);
        frontmatter = info.exists ? parseYaml(info.frontmatter) : {};
      }
      const id = frontmatter?.readwise_highlight_id;
      return { file, path: file.path, id: id == null ? undefined : String(id), reflected: frontmatter?.reflected === true, reliable: true };
    } catch {
      return { file, path: file.path, reliable: false };
    }
  }

  private async ensureFolder(folder: string): Promise<void> {
    let current = "";
    for (const part of folder.split("/").filter(Boolean)) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }
}
