import { cn } from '@/lib/utils';
import {
  Globe, Terminal, GitBranch, Package, Key, Database,
  Rocket, Search, Bug, Settings, Clock, GitMerge,
  Puzzle, Users, Shield, BarChart3, FileText, Layers,
  Presentation, Video, Play, Paintbrush, Palette, FlaskConical,
  HardDrive, Wand2, ScrollText, Activity, Eye, ShieldCheck,
  Bot, FileCode, Inbox, Github, Plug, Cpu, Network,
  Upload, Sparkles, Server, MessageCircle,
} from 'lucide-react';

interface ToolsPanelProps {
  availableTools: string[];
  onSelectTool: (tool: string) => void;
  activeTabs?: string[];
}

const toolConfig: Record<string, { icon: React.ComponentType<any>; label: string; color: string; desc: string }> = {
  preview: { icon: Globe, label: 'Preview', color: '#F5A623', desc: 'Web preview' },
  terminal: { icon: Terminal, label: 'Terminal', color: '#0CCE6B', desc: 'Command line' },
  git: { icon: GitBranch, label: 'Git', color: '#F26522', desc: 'Version control' },
  packages: { icon: Package, label: 'Packages', color: '#0CCE6B', desc: 'Dependencies' },
  secrets: { icon: Key, label: 'Secrets', color: '#F5A623', desc: 'Environment variables' },
  database: { icon: Database, label: 'Database', color: '#0079F2', desc: 'Data browser' },
  deployment: { icon: Rocket, label: 'Deploy', color: '#0CCE6B', desc: 'Publish your app' },
  search: { icon: Search, label: 'Search', color: '#0079F2', desc: 'Find in files' },
  debugger: { icon: Bug, label: 'Debugger', color: '#E54D4D', desc: 'Debug tools' },
  settings: { icon: Settings, label: 'Settings', color: '#6B7280', desc: 'Preferences' },
  history: { icon: Clock, label: 'History', color: '#F5A623', desc: 'File versions' },
  workflows: { icon: GitMerge, label: 'Workflows', color: '#0079F2', desc: 'Automations' },
  extensions: { icon: Puzzle, label: 'Extensions', color: '#0CCE6B', desc: 'Add-ons' },
  collaboration: { icon: Users, label: 'Collab', color: '#7C65CB', desc: 'Team features' },
  security: { icon: Shield, label: 'Security', color: '#7C65CB', desc: 'Vulnerability scan' },
  shell: { icon: Terminal, label: 'Shell', color: '#0CCE6B', desc: 'System shell' },
  console: { icon: Terminal, label: 'Console', color: '#0CCE6B', desc: 'App output' },
  resources: { icon: Activity, label: 'Resources', color: '#10B981', desc: 'System metrics' },
  logs: { icon: ScrollText, label: 'Logs', color: '#0079F2', desc: 'View logs' },
  'visual-editor': { icon: Wand2, label: 'Visual Editor', color: '#7C65CB', desc: 'Point & click UI' },
  slides: { icon: Presentation, label: 'Slides', color: '#F5A623', desc: 'Presentations' },
  video: { icon: Video, label: 'Video', color: '#E54D4D', desc: 'Video editor' },
  animation: { icon: Play, label: 'Animation', color: '#0CCE6B', desc: 'Motion preview' },
  design: { icon: Paintbrush, label: 'Design', color: '#7C65CB', desc: 'Design canvas' },
  storage: { icon: HardDrive, label: 'Storage', color: '#7C65CB', desc: 'Object storage' },
  themes: { icon: Palette, label: 'Themes', color: '#F26522', desc: 'Appearance' },
  testing: { icon: FlaskConical, label: 'Tests', color: '#0CCE6B', desc: 'Test runner' },
  auth: { icon: ShieldCheck, label: 'Auth', color: '#0CCE6B', desc: 'Authentication' },
  checkpoints: { icon: Clock, label: 'Checkpoints', color: '#7C65CB', desc: 'Save states' },
  // Re-integrated panels
  automations: { icon: Bot, label: 'Automations', color: '#0CCE6B', desc: 'Agent automations' },
  config: { icon: FileCode, label: 'Config', color: '#0079F2', desc: '.replit / Nix config' },
  feedback: { icon: Inbox, label: 'Feedback', color: '#F5A623', desc: 'User feedback' },
  github: { icon: Github, label: 'GitHub', color: '#F0F6FC', desc: 'Push/Pull/Sync' },
  integrations: { icon: Plug, label: 'Integrations', color: '#7C65CB', desc: 'Third-party services' },
  mcp: { icon: Cpu, label: 'MCP', color: '#0079F2', desc: 'Model Context Protocol' },
  'merge-conflicts': { icon: GitMerge, label: 'Conflicts', color: '#E54D4D', desc: 'Merge resolver' },
  monitoring: { icon: BarChart3, label: 'Monitoring', color: '#10B981', desc: 'Metrics & alerts' },
  networking: { icon: Network, label: 'Networking', color: '#0079F2', desc: 'Ports & network' },
  publishing: { icon: Upload, label: 'Publishing', color: '#0CCE6B', desc: 'Publish project' },
  skills: { icon: Sparkles, label: 'Skills', color: '#F5A623', desc: 'AI agent skills' },
  ssh: { icon: Server, label: 'SSH', color: '#6B7280', desc: 'Secure shell' },
  threads: { icon: MessageCircle, label: 'Threads', color: '#7C65CB', desc: 'Code discussions' },
  'test-runner': { icon: FlaskConical, label: 'Test Runner', color: '#0CCE6B', desc: 'Run test suites' },
  'security-scanner': { icon: ShieldCheck, label: 'Scanner', color: '#E54D4D', desc: 'Deep security scan' },
  backup: { icon: HardDrive, label: 'Backup', color: '#0079F2', desc: 'Backup & restore' },
};

export function ToolsPanel({ availableTools, onSelectTool, activeTabs = [] }: ToolsPanelProps) {
  return (
    <div className="h-full overflow-auto p-3">
      <h2 className="text-[13px] font-semibold text-[var(--ide-text)] mb-3 flex items-center gap-2">
        <Layers className="w-4 h-4 text-[var(--ide-text-muted)]" />
        Tools
      </h2>
      <div className="grid grid-cols-2 gap-1.5">
        {availableTools.map(toolId => {
          const config = toolConfig[toolId];
          if (!config) return null;
          const isActive = activeTabs.includes(toolId);
          const { icon: Icon, label, color, desc } = config;
          return (
            <button
              key={toolId}
              onClick={() => onSelectTool(toolId)}
              className={cn(
                'flex flex-col gap-1 p-2.5 rounded-lg border text-left transition-all',
                isActive
                  ? 'border-[var(--ide-border)] bg-[var(--ide-surface)]'
                  : 'border-[var(--ide-border)]/50 bg-[var(--ide-bg)] hover:bg-[var(--ide-surface)]/50'
              )}
            >
              <Icon className="w-4 h-4" style={{ color }} />
              <span className="text-[10px] font-medium text-[var(--ide-text)]">{label}</span>
              <span className="text-[9px] text-[var(--ide-text-muted)]">{desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
