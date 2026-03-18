import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

export interface TabItem {
  id: string;
  label: string;
  closable: boolean;
  pinned?: boolean;
  modified?: boolean;
  path?: string;
}

export interface FileItem {
  id: number;
  name: string;
  path?: string;
  content?: string;
  language?: string;
}

export type ActivityItem =
  | 'files' | 'search' | 'git' | 'packages' | 'debug'
  | 'terminal' | 'agent' | 'deploy' | 'secrets' | 'database'
  | 'preview' | 'workflows' | 'history' | 'extensions' | 'settings';

export const availableTools = [
  'preview', 'terminal', 'git', 'packages', 'secrets', 'database',
  'deployment', 'search', 'debugger', 'settings', 'history',
  'checkpoints', 'workflows', 'extensions', 'collaboration',
  'security', 'shell', 'console', 'resources', 'logs', 'visual-editor',
];

interface AgentToolsSettings {
  [key: string]: boolean;
}

export function useIDEWorkspace(projectId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Project data
  const projectQuery = useQuery({
    queryKey: ['/api/projects', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}`);
      return res.json();
    },
    enabled: !!projectId,
  });

  // Files data
  const filesQuery = useQuery({
    queryKey: ['/api/projects', projectId, 'files'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/files`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const project = projectQuery.data;
  const isLoadingProject = projectQuery.isLoading;

  // Tab management
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);

  // UI state
  const [showFileExplorer, setShowFileExplorer] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [activeActivityItem, setActiveActivityItem] = useState<ActivityItem>('files');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState<string>('agent');
  const [deploymentTab, setDeploymentTab] = useState<string | null>(null);
  const [showToolsSheet, setShowToolsSheet] = useState(false);
  const [showQuickFileSearch, setShowQuickFileSearch] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [agentToolsSettings, setAgentToolsSettings] = useState<AgentToolsSettings>({});

  // Git state
  const [gitBranch] = useState('main');
  const [gitChangesCount] = useState(0);

  // Editor state
  const [cursorPosition] = useState({ line: 1, column: 1 });
  const [lastSaved] = useState<Date | null>(null);
  const [problemsCount] = useState({ errors: 0, warnings: 0 });

  // Publish state
  const publishState = useMemo(() => {
    if (!project) return null;
    return {
      status: project.isPublished ? 'live' as const : 'idle' as const,
      url: project.isPublished ? `${window.location.origin}/shared/${projectId}` : undefined,
    };
  }, [project, projectId]);

  // File handling
  const handleFileSelect = useCallback((file: { id: number; name: string }) => {
    setSelectedFileId(file.id);
    const tabId = `file:${file.id}`;
    setTabs(prev => {
      if (prev.some(t => t.id === tabId)) {
        return prev;
      }
      return [...prev, {
        id: tabId,
        label: file.name.split('/').pop() || file.name,
        closable: true,
        path: file.name,
      }];
    });
    setActiveTab(tabId);
  }, []);

  // Tab handling
  const handleTabClose = useCallback((tabId: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === tabId);
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTab === tabId && newTabs.length > 0) {
        const nextIdx = Math.min(idx, newTabs.length - 1);
        setActiveTab(newTabs[nextIdx].id);
      }
      return newTabs;
    });
  }, [activeTab]);

  const handleTabReorder = useCallback((fromIndex: number, toIndex: number) => {
    setTabs(prev => {
      const newTabs = [...prev];
      const [removed] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, removed);
      return newTabs;
    });
  }, []);

  const handleTabPin = useCallback((tabId: string) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, pinned: !t.pinned } : t));
  }, []);

  const handleTabDuplicate = useCallback((tabId: string) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === tabId);
      if (!tab) return prev;
      const newTab = { ...tab, id: `${tab.id}-dup-${Date.now()}`, pinned: false };
      return [...prev, newTab];
    });
  }, []);

  const handleSplitRight = useCallback((_tabId: string) => {
    toast({ title: 'Split view', description: 'Split view coming soon' });
  }, []);

  // Run/Stop
  const handleRunStop = useCallback(() => {
    setIsRunning(prev => !prev);
  }, []);

  // Add tool as tab
  const handleAddTool = useCallback((toolId: string) => {
    const toolLabels: Record<string, string> = {
      preview: 'Preview', terminal: 'Terminal', git: 'Git',
      packages: 'Packages', secrets: 'Secrets', database: 'Database',
      deployment: 'Deploy', search: 'Search', debugger: 'Debugger',
      settings: 'Settings', history: 'History', checkpoints: 'Checkpoints',
      workflows: 'Workflows', extensions: 'Extensions', collaboration: 'Collaboration',
      security: 'Security', shell: 'Shell', console: 'Console',
      resources: 'Resources', logs: 'Logs', 'visual-editor': 'Visual Editor',
    };

    const tabId = toolId;
    setTabs(prev => {
      if (prev.some(t => t.id === tabId)) {
        return prev;
      }
      return [...prev, {
        id: tabId,
        label: toolLabels[toolId] || toolId,
        closable: true,
      }];
    });
    setActiveTab(tabId);
  }, []);

  // Map files to FileItem format
  const files: FileItem[] = useMemo(() => {
    if (!filesQuery.data) return [];
    return (filesQuery.data as any[]).map((f: any) => ({
      id: f.id,
      name: f.filename || f.name,
      path: f.filename || f.name,
      content: f.content,
      language: f.language,
    }));
  }, [filesQuery.data]);

  return {
    project,
    projectLanguage: project?.language || 'typescript',
    projectName: project?.name || 'Untitled',
    projectDescription: project?.description || '',
    files,
    isLoadingProject,
    user,
    activeTab,
    setActiveTab,
    tabs,
    selectedFileId,
    setSelectedFileId,
    showFileExplorer,
    setShowFileExplorer,
    isRunning,
    setIsRunning,
    executionId,
    setExecutionId,
    activeActivityItem,
    setActiveActivityItem,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    leftPanelTab,
    setLeftPanelTab,
    deploymentTab,
    setDeploymentTab,
    showToolsSheet,
    setShowToolsSheet,
    showQuickFileSearch,
    setShowQuickFileSearch,
    showKeyboardShortcuts,
    setShowKeyboardShortcuts,
    agentToolsSettings,
    setAgentToolsSettings,
    gitBranch,
    gitChangesCount,
    cursorPosition,
    lastSaved,
    problemsCount,
    publishState,
    handleFileSelect,
    handleTabClose,
    handleTabReorder,
    handleTabPin,
    handleTabDuplicate,
    handleSplitRight,
    handleRunStop,
    handleAddTool,
    bootstrapToken: null as string | null,
  };
}
