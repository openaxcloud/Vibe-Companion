/**
 * Default Layout for SplitsEditorLayout
 * Complete 3-column desktop IDE layout with all panels
 */

import { Split, TabInfo } from '@/types/splits';
import { 
  FileText, 
  Search, 
  GitBranch, 
  Bug, 
  FlaskConical, 
  Database, 
  Package, 
  History, 
  Key, 
  Bot, 
  Settings,
  Terminal as TerminalIcon,
  FileOutput,
  AlertTriangle,
  Play
} from 'lucide-react';

/**
 * Panel content factory type
 * Creates React content for each tab
 */
export type PanelContentFactory = {
  files?: React.ReactNode;
  search?: React.ReactNode;
  git?: React.ReactNode;
  agent?: React.ReactNode;
  debugger?: React.ReactNode;
  testing?: React.ReactNode;
  database?: React.ReactNode;
  packages?: React.ReactNode;
  history?: React.ReactNode;
  secrets?: React.ReactNode;
  settings?: React.ReactNode;
  editor?: React.ReactNode;
  terminal?: React.ReactNode;
  output?: React.ReactNode;
  problems?: React.ReactNode;
  console?: React.ReactNode;
  debugConsole?: React.ReactNode;
  preview?: React.ReactNode;
};

/**
 * Creates the default 3-column layout for desktop IDE
 * 
 * Structure:
 * - Left (20%): Tool panels (Files, Search, Git, Agent, etc.)
 * - Center (60%): Editor (70%) + Bottom panels (30%)
 *   - Bottom: Terminal, Output, Problems, Console, Debug Console
 * - Right (20%): Preview (minimized initially)
 * 
 * @param projectId - Project ID for context
 * @param panelContent - Pre-populated React content for each panel
 */
export function createEditorDefaultLayout(
  projectId: string,
  panelContent?: PanelContentFactory
): Split {
  return {
    id: 'root',
    direction: 'horizontal',
    children: [
      // Left Panel - Tool Dock Panels
      {
        id: 'left-dock',
        tabs: [
          {
            id: 'files-tab',
            title: 'Files',
            icon: <FileText className="h-4 w-4" />,
            type: 'files',
            content: panelContent?.files || null,
            canClose: false,
          },
          {
            id: 'search-tab',
            title: 'Search',
            icon: <Search className="h-4 w-4" />,
            type: 'custom',
            content: panelContent?.search || null,
            canClose: false,
          },
          {
            id: 'git-tab',
            title: 'Git',
            icon: <GitBranch className="h-4 w-4" />,
            type: 'git',
            content: panelContent?.git || null,
            canClose: false,
          },
          {
            id: 'agent-tab',
            title: 'AI Agent',
            icon: <Bot className="h-4 w-4" />,
            type: 'custom',
            content: panelContent?.agent || null,
            canClose: false,
          },
          {
            id: 'debugger-tab',
            title: 'Debugger',
            icon: <Bug className="h-4 w-4" />,
            type: 'custom',
            content: panelContent?.debugger || null,
            canClose: false,
          },
          {
            id: 'testing-tab',
            title: 'Testing',
            icon: <FlaskConical className="h-4 w-4" />,
            type: 'custom',
            content: panelContent?.testing || null,
            canClose: false,
          },
          {
            id: 'database-tab',
            title: 'Database',
            icon: <Database className="h-4 w-4" />,
            type: 'database',
            content: panelContent?.database || null,
            canClose: false,
          },
          {
            id: 'packages-tab',
            title: 'Packages',
            icon: <Package className="h-4 w-4" />,
            type: 'custom',
            content: panelContent?.packages || null,
            canClose: false,
          },
          {
            id: 'history-tab',
            title: 'History',
            icon: <History className="h-4 w-4" />,
            type: 'custom',
            content: panelContent?.history || null,
            canClose: false,
          },
          {
            id: 'secrets-tab',
            title: 'Secrets',
            icon: <Key className="h-4 w-4" />,
            type: 'custom',
            content: panelContent?.secrets || null,
            canClose: false,
          },
          {
            id: 'settings-tab',
            title: 'Settings',
            icon: <Settings className="h-4 w-4" />,
            type: 'custom',
            content: panelContent?.settings || null,
            canClose: false,
          },
        ],
        activeTabIndex: 3, // Chat/Agent tab active by default (index 3 = agent-tab)
        percent: 20,
        minSize: 200,
        maxSize: 40,
      },

      // Center Panel - Vertical split (Editor + Bottom)
      {
        id: 'center-stack',
        direction: 'vertical',
        children: [
          // Editor pane
          {
            id: 'center-editor',
            tabs: [], // Will be populated with open files
            activeTabIndex: 0,
            percent: 70,
            minSize: 300,
          },
          
          // Bottom panel - Terminal, Output, Problems, etc.
          {
            id: 'center-bottom',
            collapsible: true, // Enable collapse/expand button
            collapsed: false, // Start expanded
            parentSplitId: 'center-stack', // For resizeSplit calls
            tabs: [
              {
                id: 'terminal-tab',
                title: 'Terminal',
                icon: <TerminalIcon className="h-4 w-4" />,
                type: 'terminal',
                content: panelContent?.terminal || null,
                canClose: false,
              },
              {
                id: 'output-tab',
                title: 'Output',
                icon: <FileOutput className="h-4 w-4" />,
                type: 'custom',
                content: panelContent?.output || null,
                canClose: false,
              },
              {
                id: 'problems-tab',
                title: 'Problems',
                icon: <AlertTriangle className="h-4 w-4" />,
                type: 'custom',
                content: panelContent?.problems || null,
                canClose: false,
              },
              {
                id: 'console-tab',
                title: 'Console',
                icon: <Play className="h-4 w-4" />,
                type: 'console',
                content: panelContent?.console || null,
                canClose: false,
              },
              {
                id: 'debug-console-tab',
                title: 'Debug Console',
                icon: <Bug className="h-4 w-4" />,
                type: 'custom',
                content: panelContent?.debugConsole || null,
                canClose: false,
              },
            ],
            activeTabIndex: 0, // Terminal active by default
            percent: 30,
            minSize: 150,
            maxSize: 50,
          },
        ],
        percent: 60,
      },

      // Right Panel - Preview (minimized initially by setting percent to 0)
      {
        id: 'right-preview',
        tabs: [
          {
            id: 'preview-tab',
            title: 'Preview',
            icon: <Play className="h-4 w-4" />,
            type: 'preview',
            content: panelContent?.preview || null,
            canClose: false,
          },
        ],
        activeTabIndex: 0,
        percent: 20,
        minSize: 200,
        maxSize: 50,
      },
    ],
  };
}

/**
 * Map tool dock IDs to tab IDs in left-dock pane
 */
export const TOOL_DOCK_TO_TAB_MAP: Record<string, string> = {
  'files': 'files-tab',
  'search': 'search-tab',
  'git': 'git-tab',
  'agent': 'agent-tab',
  'debugger': 'debugger-tab',
  'testing': 'testing-tab',
  'database': 'database-tab',
  'packages': 'packages-tab',
  'history': 'history-tab',
  'secrets': 'secrets-tab',
  'settings': 'settings-tab',
};

/**
 * Reverse map for tab ID to tool dock ID
 */
export const TAB_TO_TOOL_DOCK_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(TOOL_DOCK_TO_TAB_MAP).map(([k, v]) => [v, k])
);
