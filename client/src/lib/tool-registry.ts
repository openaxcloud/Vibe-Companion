/**
 * Central Tool Registry with Rich Metadata
 * 
 * Provides comprehensive tool information including icons, descriptions,
 * categories, and availability for the IDE's tab system.
 */

import {
  Terminal,
  Code,
  Database,
  Lock,
  Package,
  TestTube,
  AlertTriangle,
  Search,
  Bug,
  Settings,
  FileText,
  Shield,
  BarChart3,
  Rocket,
  Key,
  FolderInput,
  Database as DatabaseIcon,
  PackageOpen,
  Bot,
  CreditCard,
  Puzzle,
  PlayCircle,
  Globe,
  Layers,
  FileSearch,
  ScrollText,
  Activity,
  Video,
  Users,
  UserCheck,
  HardDrive,
  History,
  BookMarked,
  Palette,
  Eye,
  type LucideIcon,
} from 'lucide-react';

export interface ToolMetadata {
  id: string;
  label: string;
  icon: LucideIcon;
  emoji: string; // Fallback emoji for compatibility
  category: 'Development' | 'Data' | 'Security' | 'Tools' | 'AI' | 'Deployment' | 'Monitoring';
  description: string;
  badge?: 'PRO' | 'NEW' | 'BETA';
  keywords?: string[];
}

/**
 * Complete tool registry matching availableTools from IDEPage
 * IMPORTANT: This registry MUST contain ALL tools from IDEPage.availableTools
 */
export const TOOL_REGISTRY: Record<string, ToolMetadata> = {
  // Development Tools
  'console': {
    id: 'console',
    label: 'Console',
    icon: Terminal,
    emoji: '🖥️',
    category: 'Development',
    description: 'View application logs and outputs',
    keywords: ['logs', 'output', 'debug'],
  },
  'terminal': {
    id: 'terminal',
    label: 'Terminal',
    icon: Terminal,
    emoji: '⌨️',
    category: 'Development',
    description: 'Shell access and command execution',
    keywords: ['bash', 'shell', 'cli'],
  },
  'shell': {
    id: 'shell',
    label: 'Shell',
    icon: Terminal,
    emoji: '⌨️',
    category: 'Development',
    description: 'Multiple shell sessions',
    keywords: ['bash', 'terminal'],
  },
  'git': {
    id: 'git',
    label: 'Git',
    icon: Code,
    emoji: '🔀',
    category: 'Tools',
    description: 'Version control with Git',
    keywords: ['commit', 'push', 'branch'],
  },
  'output': {
    id: 'output',
    label: 'Output',
    icon: FileText,
    emoji: '📄',
    category: 'Development',
    description: 'View build and compilation outputs',
    keywords: ['build', 'compile'],
  },
  'search': {
    id: 'search',
    label: 'Search',
    icon: Search,
    emoji: '🔍',
    category: 'Development',
    description: 'Search across project files',
    keywords: ['find', 'grep'],
  },
  'global-search': {
    id: 'global-search',
    label: 'Global Search',
    icon: FileSearch,
    emoji: '🔎',
    category: 'Development',
    description: 'Advanced search and replace',
    keywords: ['find', 'replace', 'regex'],
  },
  'problems': {
    id: 'problems',
    label: 'Problems',
    icon: AlertTriangle,
    emoji: '⚠️',
    category: 'Development',
    description: 'View code issues and warnings',
    keywords: ['errors', 'warnings', 'lint'],
  },
  'debugger': {
    id: 'debugger',
    label: 'Debugger',
    icon: Bug,
    emoji: '🐛',
    category: 'Development',
    description: 'Debug and inspect code execution',
    keywords: ['breakpoint', 'inspect'],
  },
  'webpreview': {
    id: 'webpreview',
    label: 'Web Preview',
    icon: Globe,
    emoji: '🌐',
    category: 'Development',
    description: 'Live preview of web applications',
    keywords: ['browser', 'preview', 'view'],
  },

  // Data & Database
  'database': {
    id: 'database',
    label: 'Database',
    icon: Database,
    emoji: '💾',
    category: 'Data',
    description: 'Browse and manage database',
    keywords: ['sql', 'postgres', 'data'],
  },
  'database-browser': {
    id: 'database-browser',
    label: 'DB Browser',
    icon: DatabaseIcon,
    emoji: '🗄️',
    category: 'Data',
    description: 'Visual database explorer',
    keywords: ['sql', 'tables', 'browse'],
  },

  // Security & Configuration
  'secrets': {
    id: 'secrets',
    label: 'Secrets',
    icon: Lock,
    emoji: '🔐',
    category: 'Security',
    description: 'Manage API keys and secrets',
    keywords: ['keys', 'env', 'credentials'],
  },
  'env': {
    id: 'env',
    label: 'Environment',
    icon: Key,
    emoji: '🔑',
    category: 'Security',
    description: 'Environment variables',
    keywords: ['env', 'config'],
  },
  'env-vars': {
    id: 'env-vars',
    label: 'Env Vars Manager',
    icon: Key,
    emoji: '🔐',
    category: 'Security',
    description: 'Manage environment variables',
    keywords: ['environment', 'config', 'secrets'],
  },
  'security': {
    id: 'security',
    label: 'Security',
    icon: Shield,
    emoji: '🛡️',
    category: 'Security',
    description: 'Security analysis and scanning',
    keywords: ['scan', 'vulnerabilities'],
  },

  // Tools & Utilities
  'packages': {
    id: 'packages',
    label: 'Packages',
    icon: Package,
    emoji: '📦',
    category: 'Tools',
    description: 'Manage project dependencies',
    keywords: ['npm', 'dependencies', 'install'],
  },
  'package-viewer': {
    id: 'package-viewer',
    label: 'Package Viewer',
    icon: PackageOpen,
    emoji: '📦',
    category: 'Tools',
    description: 'View package details',
    keywords: ['npm', 'dependencies'],
  },
  'testing': {
    id: 'testing',
    label: 'Tests',
    icon: TestTube,
    emoji: '🧪',
    category: 'Tools',
    description: 'Run and manage tests',
    keywords: ['test', 'jest', 'unit'],
  },
  'test-runner': {
    id: 'test-runner',
    label: 'Test Runner',
    icon: PlayCircle,
    emoji: '🧪',
    category: 'Tools',
    description: 'Execute test suites',
    keywords: ['test', 'run'],
  },
  'settings': {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    emoji: '⚙️',
    category: 'Tools',
    description: 'IDE preferences and configuration',
    keywords: ['config', 'preferences'],
  },
  'extensions': {
    id: 'extensions',
    label: 'Extensions',
    icon: Puzzle,
    emoji: '🧩',
    category: 'Tools',
    description: 'Manage IDE extensions',
    keywords: ['plugins', 'addons'],
  },
  'import-export': {
    id: 'import-export',
    label: 'Import/Export',
    icon: FolderInput,
    emoji: '📁',
    category: 'Tools',
    description: 'Import and export projects',
    keywords: ['backup', 'restore'],
  },

  // Progress & Activity (Replit-style)
  'progress': {
    id: 'progress',
    label: 'Progress',
    icon: Activity,
    emoji: '📊',
    category: 'Monitoring',
    description: 'Real-time agent activity feed',
    badge: 'NEW',
    keywords: ['activity', 'feed', 'actions', 'history'],
  },
  'video-replay': {
    id: 'video-replay',
    label: 'Video Replay',
    icon: Video,
    emoji: '🎬',
    category: 'Tools',
    description: 'Playback testing session recordings',
    badge: 'NEW',
    keywords: ['test', 'recording', 'playback', 'replay'],
  },

  // AI & Automation
  'ai-assistant': {
    id: 'ai-assistant',
    label: 'AI Assistant',
    icon: Bot,
    emoji: '🤖',
    category: 'AI',
    description: 'AI-powered coding assistant',
    keywords: ['chatgpt', 'copilot', 'ai'],
    badge: 'PRO',
  },

  // Collaboration
  'collaboration': {
    id: 'collaboration',
    label: 'Collaboration',
    icon: Users,
    emoji: '👥',
    category: 'Tools',
    description: 'Share and collaborate with others',
    keywords: ['share', 'invite', 'multiplayer', 'team'],
  },

  // Deployment & Monitoring
  'deployment': {
    id: 'deployment',
    label: 'Deploy',
    icon: Rocket,
    emoji: '🚀',
    category: 'Deployment',
    description: 'Deploy and manage applications',
    keywords: ['publish', 'production'],
  },
  'resources': {
    id: 'resources',
    label: 'Resources',
    icon: BarChart3,
    emoji: '📊',
    category: 'Monitoring',
    description: 'Monitor resource usage',
    keywords: ['cpu', 'memory', 'metrics'],
  },
  'logs': {
    id: 'logs',
    label: 'Logs Viewer',
    icon: ScrollText,
    emoji: '📋',
    category: 'Monitoring',
    description: 'View application logs',
    keywords: ['debug', 'console', 'output'],
  },
  'billing': {
    id: 'billing',
    label: 'Billing',
    icon: CreditCard,
    emoji: '💳',
    category: 'Tools',
    description: 'Manage billing and subscriptions',
    keywords: ['payment', 'subscription'],
  },
  
  // Visual Editor (Replit-style)
  'visual-editor': {
    id: 'visual-editor',
    label: 'Visual Editor',
    icon: Layers,
    emoji: '🎨',
    category: 'Development',
    description: 'Edit UI elements visually with drag-and-drop',
    badge: 'NEW',
    keywords: ['design', 'visual', 'drag', 'drop', 'ui', 'wysiwyg'],
  },
  
  // Rewind/History (Replit-style)
  'rewind': {
    id: 'rewind',
    label: 'Rewind',
    icon: Activity,
    emoji: '⏪',
    category: 'Tools',
    description: 'Time-travel through project history',
    badge: 'NEW',
    keywords: ['history', 'undo', 'restore', 'checkpoint', 'backup'],
  },
  
  // Workflows (Replit-style)
  'workflows': {
    id: 'workflows',
    label: 'Workflows',
    icon: PlayCircle,
    emoji: '⚡',
    category: 'Tools',
    description: 'Save and run development workflows',
    badge: 'NEW',
    keywords: ['automation', 'scripts', 'tasks', 'run'],
  },
  'auth': {
    id: 'auth',
    label: 'Auth',
    icon: UserCheck,
    emoji: '🔐',
    category: 'Security',
    description: 'Let users log in to your App using a prebuilt login page',
    keywords: ['authentication', 'login', 'users', 'oauth', 'google', 'github'],
  },
  'storage': {
    id: 'storage',
    label: 'App Storage',
    icon: HardDrive,
    emoji: '🗂️',
    category: 'Data',
    description: 'Host and save uploads like images, videos, and documents',
    keywords: ['files', 'upload', 'object storage', 'bucket', 's3'],
  },
  'history': {
    id: 'history',
    label: 'History',
    icon: History,
    emoji: '⏱️',
    category: 'Tools',
    description: 'View file and project change history',
    keywords: ['undo', 'changes', 'timeline', 'revisions'],
  },
  'checkpoints': {
    id: 'checkpoints',
    label: 'Checkpoints',
    icon: BookMarked,
    emoji: '📌',
    category: 'Tools',
    description: 'Save and restore project snapshots',
    keywords: ['snapshot', 'rollback', 'backup', 'restore'],
  },
  'themes': {
    id: 'themes',
    label: 'Themes',
    icon: Palette,
    emoji: '🎨',
    category: 'Tools',
    description: 'Customize the editor appearance and color theme',
    keywords: ['colors', 'dark mode', 'light mode', 'appearance'],
  },
  'multiplayers': {
    id: 'multiplayers',
    label: 'Multiplayer',
    icon: Users,
    emoji: '👥',
    category: 'Tools',
    description: 'Collaborate in real-time with teammates',
    keywords: ['collaboration', 'pair programming', 'share', 'real-time'],
  },
  'deploy': {
    id: 'deploy',
    label: 'Deploy',
    icon: Rocket,
    emoji: '🚀',
    category: 'Deployment',
    description: 'Publish your app to the web',
    keywords: ['publish', 'hosting', 'production', 'live'],
  },
  'preview': {
    id: 'preview',
    label: 'Preview',
    icon: Eye,
    emoji: '👁️',
    category: 'Development',
    description: 'Preview your running application',
    keywords: ['browser', 'view', 'web', 'live'],
  },
};

/**
 * Validation: Check if all tools from IDEPage.availableTools are present
 * Run this in development to ensure registry completeness
 */
export function validateToolRegistry(availableTools: { id: string; label: string; icon: string }[]): { valid: boolean; missing: string[] } {
  const registryIds = new Set(Object.keys(TOOL_REGISTRY));
  const missing = availableTools
    .filter(tool => !registryIds.has(tool.id))
    .map(tool => tool.id);
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get tool metadata by ID
 */
export function getToolMetadata(toolId: string): ToolMetadata | undefined {
  return TOOL_REGISTRY[toolId];
}

/**
 * Get all tools by category
 */
export function getToolsByCategory(category: ToolMetadata['category']): ToolMetadata[] {
  return Object.values(TOOL_REGISTRY).filter(tool => tool.category === category);
}

/**
 * Get all available categories
 */
export function getAllCategories(): ToolMetadata['category'][] {
  return ['Development', 'Data', 'Security', 'Tools', 'AI', 'Deployment', 'Monitoring'];
}

/**
 * Search tools by keywords
 */
export function searchTools(query: string): ToolMetadata[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(TOOL_REGISTRY).filter(tool => 
    tool.label.toLowerCase().includes(lowerQuery) ||
    tool.description.toLowerCase().includes(lowerQuery) ||
    tool.keywords?.some(k => k.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Convert tool metadata to simple format for backward compatibility
 */
export function toSimpleTool(metadata: ToolMetadata): { id: string; label: string; icon: string } {
  return {
    id: metadata.id,
    label: metadata.label,
    icon: metadata.emoji,
  };
}
