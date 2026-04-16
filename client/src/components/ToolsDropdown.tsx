import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Database,
  Terminal,
  Code,
  Shield,
  Eye,
  Bot,
  Cloud,
  Users,
  Package,
  Key,
  GitBranch,
  Network,
  HardDrive,
  AlertCircle,
  ShieldCheck,
  FileSearch,
  Settings,
  Monitor,
  Puzzle,
  Zap,
  MessageSquareText,
  Link2
} from 'lucide-react';

interface ToolsDropdownProps {
  onSelectTool: (tool: string) => void;
  currentTools: string[];
}

export const ToolsDropdown: React.FC<ToolsDropdownProps> = ({ onSelectTool, currentTools }) => {
  const tools = [
    // Primary Tools
    { id: 'assistant', label: 'Assistant', icon: Bot, description: 'AI-powered coding assistant for your project' },
    { id: 'database', label: 'Database', icon: Database, description: 'Browse and query your project database' },
    { id: 'shell', label: 'Shell', icon: Terminal, description: 'Interactive terminal for running commands' },
    { id: 'workflows', label: 'Workflows', icon: Zap, description: 'Automate build, test, and deploy workflows' },
    { id: 'secrets', label: 'Secrets', icon: Key, description: 'Manage environment variables and API keys' },
    { id: 'console', label: 'Console', icon: Code, description: 'View application output and logs' },
    { id: 'authentication', label: 'Authentication', icon: Shield, description: 'Configure user authentication for your app' },
    { id: 'preview', label: 'Preview', icon: Eye, description: 'Live preview of your running application' },
    { id: 'agent', label: 'Agent', icon: Bot, description: 'AI agent that builds features autonomously' },
    { id: 'deployments', label: 'Deployments', icon: Cloud, description: 'Deploy and manage production releases' },
    
    // Additional Tools
    { id: 'auth', label: 'Auth', icon: Users, description: 'Get users to log in to your app using a prebuilt login page' },
    { id: 'code-search', label: 'Code Search', icon: FileSearch, description: 'Search through the text contents of your app' },
    { id: 'install', label: 'Packages', icon: Package, description: 'Install, upgrade, and manage dependencies' },
    { id: 'docs', label: 'Docs', icon: MessageSquareText, description: 'View Replit Documentation to learn about workspace features, AI, Deployments, and more' },
    { id: 'extension-store', label: 'Extension Store', icon: Puzzle, description: 'Find and install workspace extensions' },
    
    // Advanced Tools (from third screenshot)
    { id: 'git', label: 'Git', icon: GitBranch, description: 'Version control for your App' },
    { id: 'integrations', label: 'Integrations', icon: Link2, description: 'Connect to Replit-native and external services' },
    { id: 'networking', label: 'Networking', icon: Network, description: 'Configure web server ports for your App' },
    { id: 'object-storage', label: 'Object Storage', icon: HardDrive, description: 'Persistent, shared file storage which can be accessed programmatically in your App' },
    { id: 'problems', label: 'Problems', icon: AlertCircle, description: 'View problems in your code detected by static analysis tools like type checkers and linters' },
    { id: 'replit-key-value', label: 'Replit Key-Value Store', icon: Database, description: 'Free, easy-to-use key-value store suitable for unstructured data, caching, session management, fast lookups, and flexible data models' },
    { id: 'security-scanner', label: 'Security Scanner', icon: ShieldCheck, description: 'Scan your app for vulnerabilities' },
    { id: 'ssh', label: 'SSH', icon: Terminal, description: 'Configure remote access to connect to this Repl from another machine or IDE' },
    { id: 'threads', label: 'Threads', icon: MessageSquareText, description: 'Comment and discuss topics with collaborators directly inside code or text files' },
    { id: 'user-settings', label: 'User Settings', icon: Settings, description: 'Configure personal editor preferences and workspace settings which apply to all Apps' },
    { id: 'vnc', label: 'VNC', icon: Monitor, description: 'View your app\'s desktop screen output' },
    
    // Advanced UI Components (New)
    { id: 'fork-graph', label: 'Fork Graph', icon: GitBranch, description: 'Interactive visualization of project fork networks' },
    { id: 'version-control', label: 'Version Control', icon: GitBranch, description: 'Comprehensive Git integration with diff viewer and branch management' },
    { id: 'package-explorer', label: 'Package Explorer', icon: Package, description: 'Visual dependency tree showing package relationships' },
    { id: 'resource-monitor', label: 'Resource Monitor', icon: Monitor, description: 'Real-time CPU/memory/disk/network monitoring with live charts' },
    { id: 'deployment-pipeline', label: 'Deployment Pipeline', icon: Settings, description: 'Visual CI/CD pipeline with stage-by-stage progress tracking' },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          New tab
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px] sm:w-[320px] max-h-[70vh] overflow-y-auto">
        <div className="p-2">
          <input
            type="text"
            placeholder="Search for files & tools..."
            className="w-full px-3 py-2 text-[13px] bg-muted rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        
        <DropdownMenuSeparator />
        
        <div className="p-1">
          <div className="text-[11px] font-medium text-muted-foreground px-2 py-1">Tools</div>
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = currentTools.includes(tool.id);
            
            return (
              <DropdownMenuItem
                key={tool.id}
                onClick={() => onSelectTool(tool.id)}
                className="flex items-center gap-2 p-2 cursor-pointer"
                data-testid={`tool-${tool.id}`}
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-[13px] truncate">{tool.label}</span>
                {isActive && (
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">Active</span>
                )}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};