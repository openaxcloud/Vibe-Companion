import * as fs from 'fs/promises';
import * as path from 'path';
import { storage } from '../storage';

export interface Extension {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: 'theme' | 'language' | 'formatter' | 'linter' | 'snippet' | 'debugger' | 'other';
  icon?: string;
  enabled: boolean;
  config?: Record<string, any>;
  permissions: string[];
  main?: string;
  activation?: string[];
  contributes?: {
    commands?: Array<{
      command: string;
      title: string;
      category?: string;
    }>;
    keybindings?: Array<{
      command: string;
      key: string;
      when?: string;
    }>;
    languages?: Array<{
      id: string;
      extensions: string[];
      aliases?: string[];
    }>;
    themes?: Array<{
      id: string;
      label: string;
      uiTheme: 'vs-dark' | 'vs-light';
      path: string;
    }>;
    snippets?: Array<{
      language: string;
      path: string;
    }>;
  };
}

export interface InstalledExtension {
  userId: number;
  extensionId: string;
  enabled: boolean;
  config: Record<string, any>;
  installedAt: Date;
  updatedAt: Date;
}

export class ExtensionManager {
  private extensionsPath: string;
  private builtInExtensions: Map<string, Extension> = new Map();
  private userExtensions: Map<string, Map<string, Extension>> = new Map();

  constructor() {
    this.extensionsPath = path.join(process.cwd(), '.extensions');
    this.initializeExtensions();
  }

  private async initializeExtensions() {
    try {
      await fs.mkdir(this.extensionsPath, { recursive: true });
      this.loadBuiltInExtensions();
    } catch (error) {
      console.error('Failed to initialize extensions:', error);
    }
  }

  private loadBuiltInExtensions() {
    // Load built-in extensions
    const builtInExtensions: Extension[] = [
      {
        id: 'replit.dark-theme',
        name: 'E-Code Dark Theme',
        version: '1.0.0',
        description: 'Official E-Code dark theme',
        author: 'E-Code',
        category: 'theme',
        enabled: true,
        permissions: [],
        contributes: {
          themes: [{
            id: 'replit-dark',
            label: 'E-Code Dark',
            uiTheme: 'vs-dark',
            path: './themes/replit-dark.json'
          }]
        }
      },
      {
        id: 'replit.python-support',
        name: 'Python Language Support',
        version: '1.0.0',
        description: 'Python language support with IntelliSense',
        author: 'E-Code',
        category: 'language',
        enabled: true,
        permissions: ['workspace', 'language-server'],
        contributes: {
          languages: [{
            id: 'python',
            extensions: ['.py', '.pyw'],
            aliases: ['Python', 'py']
          }]
        }
      },
      {
        id: 'replit.prettier',
        name: 'Prettier Formatter',
        version: '1.0.0',
        description: 'Code formatter using Prettier',
        author: 'E-Code',
        category: 'formatter',
        enabled: true,
        permissions: ['workspace'],
        contributes: {
          commands: [{
            command: 'prettier.format',
            title: 'Format Document',
            category: 'Prettier'
          }]
        }
      },
      {
        id: 'replit.eslint',
        name: 'ESLint',
        version: '1.0.0',
        description: 'JavaScript linter',
        author: 'E-Code',
        category: 'linter',
        enabled: true,
        permissions: ['workspace'],
        contributes: {
          commands: [{
            command: 'eslint.lint',
            title: 'Lint File',
            category: 'ESLint'
          }]
        }
      },
      {
        id: 'replit.snippets',
        name: 'Code Snippets',
        version: '1.0.0',
        description: 'Common code snippets',
        author: 'E-Code',
        category: 'snippet',
        enabled: true,
        permissions: [],
        contributes: {
          snippets: [
            {
              language: 'javascript',
              path: './snippets/javascript.json'
            },
            {
              language: 'python',
              path: './snippets/python.json'
            }
          ]
        }
      }
    ];

    builtInExtensions.forEach(ext => {
      this.builtInExtensions.set(ext.id, ext);
    });
  }

  async getAvailableExtensions(): Promise<Extension[]> {
    return Array.from(this.builtInExtensions.values());
  }

  async getUserExtensions(userId: number): Promise<Extension[]> {
    const userExtMap = this.userExtensions.get(userId.toString()) || new Map();
    const extensions = Array.from(userExtMap.values());
    
    // Merge with built-in extensions
    const allExtensions = [...this.builtInExtensions.values()];
    
    // Add user-specific extensions
    extensions.forEach(ext => {
      if (!allExtensions.find(e => e.id === ext.id)) {
        allExtensions.push(ext);
      }
    });

    return allExtensions;
  }

  async installExtension(userId: number, extensionId: string): Promise<boolean> {
    try {
      const extension = this.builtInExtensions.get(extensionId);
      if (!extension) {
        throw new Error('Extension not found');
      }

      // Save installation record
      await this.saveUserExtension(userId, extensionId, {
        enabled: true,
        config: {},
        installedAt: new Date(),
        updatedAt: new Date()
      });

      return true;
    } catch (error) {
      console.error('Failed to install extension:', error);
      return false;
    }
  }

  async uninstallExtension(userId: number, extensionId: string): Promise<boolean> {
    try {
      await this.removeUserExtension(userId, extensionId);
      return true;
    } catch (error) {
      console.error('Failed to uninstall extension:', error);
      return false;
    }
  }

  async enableExtension(userId: number, extensionId: string): Promise<boolean> {
    return this.updateExtensionStatus(userId, extensionId, true);
  }

  async disableExtension(userId: number, extensionId: string): Promise<boolean> {
    return this.updateExtensionStatus(userId, extensionId, false);
  }

  async configureExtension(
    userId: number,
    extensionId: string,
    config: Record<string, any>
  ): Promise<boolean> {
    try {
      const userExt = await this.getUserExtension(userId, extensionId);
      if (!userExt) {
        throw new Error('Extension not installed');
      }

      userExt.config = { ...userExt.config, ...config };
      userExt.updatedAt = new Date();

      await this.saveUserExtension(userId, extensionId, userExt);
      return true;
    } catch (error) {
      console.error('Failed to configure extension:', error);
      return false;
    }
  }

  async getExtensionCommands(userId: number): Promise<Array<{
    command: string;
    title: string;
    category?: string;
    extensionId: string;
  }>> {
    const extensions = await this.getUserExtensions(userId);
    const commands: Array<any> = [];

    extensions.forEach(ext => {
      if (ext.enabled && ext.contributes?.commands) {
        ext.contributes.commands.forEach(cmd => {
          commands.push({
            ...cmd,
            extensionId: ext.id
          });
        });
      }
    });

    return commands;
  }

  async getExtensionKeybindings(userId: number): Promise<Array<{
    command: string;
    key: string;
    when?: string;
    extensionId: string;
  }>> {
    const extensions = await this.getUserExtensions(userId);
    const keybindings: Array<any> = [];

    extensions.forEach(ext => {
      if (ext.enabled && ext.contributes?.keybindings) {
        ext.contributes.keybindings.forEach(kb => {
          keybindings.push({
            ...kb,
            extensionId: ext.id
          });
        });
      }
    });

    return keybindings;
  }

  async getActiveThemes(userId: number): Promise<Array<{
    id: string;
    label: string;
    uiTheme: string;
    extensionId: string;
  }>> {
    const extensions = await this.getUserExtensions(userId);
    const themes: Array<any> = [];

    extensions.forEach(ext => {
      if (ext.enabled && ext.contributes?.themes) {
        ext.contributes.themes.forEach(theme => {
          themes.push({
            ...theme,
            extensionId: ext.id
          });
        });
      }
    });

    return themes;
  }

  async getLanguageSupport(userId: number): Promise<Map<string, string[]>> {
    const extensions = await this.getUserExtensions(userId);
    const languageMap = new Map<string, string[]>();

    extensions.forEach(ext => {
      if (ext.enabled && ext.contributes?.languages) {
        ext.contributes.languages.forEach(lang => {
          languageMap.set(lang.id, lang.extensions);
        });
      }
    });

    return languageMap;
  }

  async getSnippets(userId: number, language: string): Promise<any[]> {
    const extensions = await this.getUserExtensions(userId);
    const snippets: any[] = [];

    for (const ext of extensions) {
      if (ext.enabled && ext.contributes?.snippets) {
        const langSnippets = ext.contributes.snippets.filter(s => s.language === language);
        
        for (const snippet of langSnippets) {
          // Load snippet content
          const snippetContent = await this.loadSnippetFile(ext.id, snippet.path);
          if (snippetContent) {
            snippets.push(...snippetContent);
          }
        }
      }
    }

    return snippets;
  }

  private async getUserExtension(userId: number, extensionId: string): Promise<InstalledExtension | null> {
    // In real implementation, this would fetch from database
    return null;
  }

  private async saveUserExtension(
    userId: number,
    extensionId: string,
    data: Partial<InstalledExtension>
  ): Promise<void> {
    // In real implementation, this would save to database
  }

  private async removeUserExtension(userId: number, extensionId: string): Promise<void> {
    // In real implementation, this would remove from database
  }

  private async updateExtensionStatus(
    userId: number,
    extensionId: string,
    enabled: boolean
  ): Promise<boolean> {
    try {
      const userExt = await this.getUserExtension(userId, extensionId);
      if (!userExt) {
        throw new Error('Extension not installed');
      }

      userExt.enabled = enabled;
      userExt.updatedAt = new Date();

      await this.saveUserExtension(userId, extensionId, userExt);
      return true;
    } catch (error) {
      console.error('Failed to update extension status:', error);
      return false;
    }
  }

  private async loadSnippetFile(extensionId: string, snippetPath: string): Promise<any[]> {
    // In real implementation, this would load actual snippet files
    // For now, return sample snippets
    if (snippetPath.includes('javascript')) {
      return [
        {
          prefix: 'log',
          body: ['console.log($1);'],
          description: 'Console log'
        },
        {
          prefix: 'func',
          body: [
            'function ${1:functionName}(${2:params}) {',
            '\t$0',
            '}'
          ],
          description: 'Function declaration'
        }
      ];
    }
    
    return [];
  }
}

export const extensionManager = new ExtensionManager();