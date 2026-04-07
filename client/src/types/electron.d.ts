/**
 * E-Code Desktop - Electron API Type Definitions
 * Fortune 500 Quality TypeScript Types
 * 
 * These types define the electronAPI exposed by the preload script
 */

export interface ElectronDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
  properties?: Array<
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'promptToCreate'
    | 'noResolveAliases'
    | 'treatPackageAsDirectory'
    | 'dontAddToRecent'
  >;
  message?: string;
  securityScopedBookmarks?: boolean;
}

export interface ElectronSaveDialogResult {
  canceled: boolean;
  filePath?: string;
  bookmark?: string;
}

export interface ElectronOpenDialogResult {
  canceled: boolean;
  filePaths: string[];
  bookmarks?: string[];
}

export interface ElectronMessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message: string;
  detail?: string;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  icon?: string;
  cancelId?: number;
  noLink?: boolean;
  normalizeAccessKeys?: boolean;
}

export interface ElectronMessageBoxResult {
  response: number;
  checkboxChecked: boolean;
}

export interface ElectronDirectoryEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export type ThemeSource = 'system' | 'light' | 'dark';

export interface ElectronAPI {
  // Platform Detection
  readonly isElectron: true;
  readonly isDesktop: true;

  // App Information
  getAppVersion(): Promise<string>;
  getPlatform(): Promise<NodeJS.Platform>;
  getAppPath(name: 'home' | 'appData' | 'userData' | 'sessionData' | 'temp' | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | 'logs' | 'crashDumps'): Promise<string>;
  isDev(): Promise<boolean>;
  isPackaged(): Promise<boolean>;

  // Theme Management
  getSystemTheme(): Promise<'light' | 'dark'>;
  setThemeSource(source: ThemeSource): Promise<void>;
  onThemeChange(callback: (theme: 'light' | 'dark') => void): () => void;

  // Dialog APIs
  showSaveDialog(options: ElectronDialogOptions): Promise<ElectronSaveDialogResult>;
  showOpenDialog(options: ElectronDialogOptions): Promise<ElectronOpenDialogResult>;
  showMessageBox(options: ElectronMessageBoxOptions): Promise<ElectronMessageBoxResult>;

  // File System APIs
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<boolean>;
  fileExists(filePath: string): Promise<boolean>;
  readDirectory(dirPath: string): Promise<ElectronDirectoryEntry[]>;

  // Shell APIs
  openExternal(url: string): Promise<void>;
  openPath(path: string): Promise<void>;
  showItemInFolder(path: string): void;

  // Window APIs
  minimizeWindow(): Promise<void>;
  maximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  isMaximized(): Promise<boolean>;
  isFullscreen(): Promise<boolean>;
  setFullscreen(flag: boolean): Promise<void>;

  // Persistent Storage APIs
  storeGet<T>(key: string, defaultValue?: T): Promise<T>;
  storeSet<T>(key: string, value: T): Promise<void>;
  storeDelete(key: string): Promise<void>;

  // Clipboard APIs
  clipboardWriteText(text: string): Promise<void>;
  clipboardReadText(): Promise<string>;

  // IPC Communication
  on(channel: string, callback: (...args: any[]) => void): () => void;
  once(channel: string, callback: (...args: any[]) => void): void;
  send(channel: string, ...args: any[]): void;
  removeAllListeners(channel: string): void;

  // Menu Event Listeners
  onMenuNewProject(callback: () => void): () => void;
  onMenuOpenProject(callback: () => void): () => void;
  onMenuSave(callback: () => void): () => void;
  onMenuSaveAll(callback: () => void): () => void;
  onMenuPreferences(callback: () => void): () => void;
  onMenuFind(callback: () => void): () => void;
  onMenuFindReplace(callback: () => void): () => void;
  onMenuNewTerminal(callback: () => void): () => void;
  onMenuClearTerminal(callback: () => void): () => void;
  onMenuToggleSidebar(callback: () => void): () => void;
  onMenuToggleTerminal(callback: () => void): () => void;
  onMenuToggleAI(callback: () => void): () => void;
  onMenuQuickOpen(callback: () => void): () => void;
  onMenuGoToLine(callback: () => void): () => void;
  onMenuGoToSymbol(callback: () => void): () => void;
  onMenuGoToDefinition(callback: () => void): () => void;
  onMenuRunCode(callback: () => void): () => void;
  onMenuStopExecution(callback: () => void): () => void;
  onMenuShowShortcuts(callback: () => void): () => void;
}

// Extend Window interface
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
