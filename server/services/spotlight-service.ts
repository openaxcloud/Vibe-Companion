// @ts-nocheck
import { DatabaseStorage } from '../storage';

export interface SpotlightItem {
  id: string;
  type: 'file' | 'project' | 'action' | 'setting' | 'user' | 'help';
  title: string;
  subtitle?: string;
  icon?: string;
  action: {
    type: 'navigate' | 'execute' | 'open';
    target: string;
    params?: any;
  };
  keywords: string[];
  score?: number;
}

export interface RecentItem {
  id: string;
  type: SpotlightItem['type'];
  title: string;
  timestamp: Date;
  action: SpotlightItem['action'];
}

export class SpotlightService {
  private recentItems: RecentItem[] = [];
  
  constructor(private storage: DatabaseStorage) {}

  async search(query: string, userId: number): Promise<SpotlightItem[]> {
    const results: SpotlightItem[] = [];
    const normalizedQuery = query.toLowerCase();
    
    // Search files across all user projects
    const projects = await this.storage.getProjectsByUser(userId);
    for (const project of projects) {
      const files = await this.storage.getProjectFiles(project.id);
      files.forEach(file => {
        if (file.name.toLowerCase().includes(normalizedQuery)) {
          results.push({
            id: `file-${file.id}`,
            type: 'file',
            title: file.name,
            subtitle: `in ${project.name}`,
            icon: 'file',
            action: {
              type: 'navigate',
              target: `/project/${project.id}`,
              params: { fileId: file.id }
            },
            keywords: [file.name, project.name],
            score: this.calculateScore(file.name, normalizedQuery)
          });
        }
      });
    }
    
    // Search projects
    projects.forEach(project => {
      if (project.name.toLowerCase().includes(normalizedQuery)) {
        results.push({
          id: `project-${project.id}`,
          type: 'project',
          title: project.name,
          subtitle: project.language,
          icon: 'folder',
          action: {
            type: 'navigate',
            target: `/project/${project.id}`
          },
          keywords: [project.name, project.language || ''],
          score: this.calculateScore(project.name, normalizedQuery)
        });
      }
    });
    
    // Search actions
    const actions = this.getAvailableActions();
    actions.forEach(action => {
      if (action.keywords.some(kw => kw.includes(normalizedQuery))) {
        results.push({
          ...action,
          score: this.calculateScore(action.title, normalizedQuery)
        });
      }
    });
    
    // Sort by score
    return results.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 20);
  }

  private calculateScore(text: string, query: string): number {
    const normalizedText = text.toLowerCase();
    if (normalizedText === query) return 100;
    if (normalizedText.startsWith(query)) return 80;
    if (normalizedText.includes(query)) return 60;
    return 40;
  }

  private getAvailableActions(): SpotlightItem[] {
    return [
      {
        id: 'action-new-project',
        type: 'action',
        title: 'Create New Project',
        subtitle: 'Start a new coding project',
        icon: 'plus',
        action: { type: 'navigate', target: '/projects/new' },
        keywords: ['new', 'create', 'project', 'start']
      },
      {
        id: 'action-ai-agent',
        type: 'action',
        title: 'Open AI Agent',
        subtitle: 'Build with AI assistance',
        icon: 'sparkles',
        action: { type: 'navigate', target: '/agent' },
        keywords: ['ai', 'agent', 'assistant', 'help', 'build']
      },
      {
        id: 'action-deploy',
        type: 'action',
        title: 'Deploy Project',
        subtitle: 'Deploy current project',
        icon: 'rocket',
        action: { type: 'execute', target: 'deploy-current' },
        keywords: ['deploy', 'publish', 'ship', 'production']
      },
      {
        id: 'action-settings',
        type: 'action',
        title: 'Open Settings',
        subtitle: 'Account and preferences',
        icon: 'settings',
        action: { type: 'navigate', target: '/account' },
        keywords: ['settings', 'preferences', 'account', 'profile']
      },
      {
        id: 'action-docs',
        type: 'action',
        title: 'Documentation',
        subtitle: 'View E-Code docs',
        icon: 'book',
        action: { type: 'navigate', target: '/docs' },
        keywords: ['docs', 'documentation', 'help', 'guide']
      },
      {
        id: 'action-teams',
        type: 'action',
        title: 'Manage Teams',
        subtitle: 'Team collaboration',
        icon: 'users',
        action: { type: 'navigate', target: '/teams' },
        keywords: ['teams', 'collaborate', 'share', 'workspace']
      },
      {
        id: 'action-github-import',
        type: 'action',
        title: 'Import from GitHub',
        subtitle: 'Import a GitHub repository',
        icon: 'github',
        action: { type: 'navigate', target: '/github-import' },
        keywords: ['import', 'github', 'clone', 'repository']
      },
      {
        id: 'action-terminal',
        type: 'action',
        title: 'Open Terminal',
        subtitle: 'Access shell',
        icon: 'terminal',
        action: { type: 'navigate', target: '/shell' },
        keywords: ['terminal', 'shell', 'console', 'command']
      }
    ];
  }

  async addRecentItem(item: Omit<RecentItem, 'timestamp'>): Promise<void> {
    const recentItem: RecentItem = {
      ...item,
      timestamp: new Date()
    };
    
    this.recentItems.unshift(recentItem);
    this.recentItems = this.recentItems.slice(0, 10); // Keep only 10 recent items
    
    // Store in database for persistence
    await this.storage.addRecentSpotlightItem(recentItem);
  }

  async getRecentItems(userId: number): Promise<RecentItem[]> {
    return this.storage.getRecentSpotlightItems(userId);
  }

  async clearRecentItems(userId: number): Promise<void> {
    this.recentItems = [];
    await this.storage.clearRecentSpotlightItems(userId);
  }
}