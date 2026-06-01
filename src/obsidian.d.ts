declare module "obsidian" {
  export class App {
    vault: Vault;
    workspace: Workspace;
    metadataCache: MetadataCache;
  }
  export class Plugin {
    app: App;
    onload(): void | Promise<void>;
    onunload(): void;
    loadData(): Promise<unknown>;
    saveData(data: unknown): Promise<void>;
    registerView(type: string, viewCreator: (leaf: WorkspaceLeaf) => ItemView): void;
    addRibbonIcon(icon: string, title: string, callback: (evt: MouseEvent) => unknown): HTMLElement;
    addCommand(command: { id: string; name: string; callback: () => unknown }): void;
    addSettingTab(tab: PluginSettingTab): void;
  }
  export class PluginSettingTab {
    app: App;
    plugin: Plugin;
    containerEl: HTMLElement;
    constructor(app: App, plugin: Plugin);
    display(): void;
  }
  export class ItemView {
    app: App;
    leaf: WorkspaceLeaf;
    containerEl: HTMLElement;
    constructor(leaf: WorkspaceLeaf);
    getViewType(): string;
    getDisplayText(): string;
    getIcon?(): string;
    onOpen?(): void | Promise<void>;
  }
  export class Modal {
    app: App;
    contentEl: HTMLElement;
    constructor(app: App);
    open(): void;
    close(): void;
    onOpen?(): void;
  }
  export class FuzzySuggestModal<T> extends Modal {
    setPlaceholder(placeholder: string): void;
    getItems(): T[];
    getItemText(item: T): string;
    onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void;
  }
  export class Notice {
    constructor(message: string, timeout?: number);
  }
  export class Setting {
    settingEl: HTMLElement;
    constructor(containerEl: HTMLElement);
    setName(name: string): this;
    setDesc(desc: string): this;
    addText(cb: (component: TextComponent) => unknown): this;
    addTextArea(cb: (component: TextAreaComponent) => unknown): this;
    addButton(cb: (component: ButtonComponent) => unknown): this;
  }
  export class TextComponent {
    inputEl: HTMLInputElement;
    setPlaceholder(placeholder: string): this;
    setValue(value: string): this;
    onChange(callback: (value: string) => unknown): this;
  }
  export class TextAreaComponent {
    inputEl: HTMLTextAreaElement;
    setPlaceholder(placeholder: string): this;
    setValue(value: string): this;
    onChange(callback: (value: string) => unknown): this;
  }
  export class ButtonComponent {
    setButtonText(text: string): this;
    setCta(): this;
    onClick(callback: (evt: MouseEvent) => unknown): this;
  }
  export class TFile {
    path: string;
    basename: string;
  }
  export interface Vault {
    getAbstractFileByPath(path: string): TFile | unknown | null;
    getMarkdownFiles(): TFile[];
    read(file: TFile): Promise<string>;
    modify(file: TFile, data: string): Promise<void>;
    create(path: string, data: string): Promise<TFile>;
    createFolder(path: string): Promise<void>;
  }
  export interface Workspace {
    getLeavesOfType(type: string): WorkspaceLeaf[];
    detachLeavesOfType(type: string): void;
    getRightLeaf(split: boolean): WorkspaceLeaf | null;
    getLeaf(newLeaf?: boolean | "tab"): WorkspaceLeaf;
    revealLeaf(leaf: WorkspaceLeaf): void;
  }
  export interface WorkspaceLeaf {
    setViewState(state: { type: string; active?: boolean }): Promise<void>;
    openFile(file: TFile): Promise<void>;
  }
  export interface MetadataCache {
    getFileCache(file: TFile): { frontmatter?: Record<string, unknown> } | null;
  }
  export function normalizePath(path: string): string;
  export function requestUrl(options: { url: string; method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; json: unknown; text: string }>;
}

interface HTMLElement {
  empty(): void;
  addClass(cls: string): void;
  createEl<K extends keyof HTMLElementTagNameMap>(tag: K, options?: { text?: string; cls?: string }): HTMLElementTagNameMap[K];
  createDiv(options?: { cls?: string; text?: string }): HTMLDivElement;
  createSpan(options?: { cls?: string; text?: string }): HTMLSpanElement;
  appendText(text: string): void;
}

declare function createDiv(options?: { cls?: string; text?: string }): HTMLDivElement;
