// @ts-nocheck
/**
 * UnifiedIDELayout - Responsive IDE that adapts to screen size
 * 
 * Layout modes:
 * - Desktop (>1024px): 3 resizable panels (AI Agent 30% | Main Content 52% | File Explorer 18%)
 * - Tablet (768-1024px): 2 panels with collapsible sidebar
 * - Mobile (<768px): Bottom tab navigation with swipe between panels
 * 
 * Uses useIDEWorkspace for centralized state management
 */

import { useState, useCallback, Suspense, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { createPanHandlers, type PanInfo } from '@/lib/native-motion';
import { useIDEWorkspace, availableTools } from '@/hooks';
import { useDeviceType } from '@/hooks/use-media-query';
import { useConnectionStatus } from '@/hooks/use-connection-status';
import { useProblemsCount } from '@/hooks/use-problems-count';
import { useToast } from '@/hooks/use-toast';
import { instrumentedLazy } from '@/utils/instrumented-lazy';
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { ProjectGuest } from '@shared/schema';
import { 
  Brain, 
  Zap, 
  X, 
  Layers, 
  Rocket, 
  PanelLeftOpen, 
  PanelLeftClose,
  ChevronLeft,
  Code,
  Terminal,
  Monitor,
  Bot,
  MoreHorizontal,
  Check,
  Copy,
  ExternalLink,
  Lock,
  FolderOpen,
  Download,
  Upload
} from 'lucide-react';
import { ECodeLoading } from '@/components/ECodeLoading';

import { TopNavBar } from '@/components/ide/TopNavBar';
import { StatusBar } from '@/components/ide/StatusBar';
import { ReplitActivityBar, type ActivityItem } from '@/components/ide/ReplitActivityBar';
import { ReplitTabBar } from '@/components/ide/ReplitTabBar';
import { ReplitToolsSheet } from '@/components/ide/ReplitToolsSheet';
import { QuickFileSearch } from '@/components/ide/QuickFileSearch';
import { KeyboardShortcutsOverlay } from '@/components/ide/KeyboardShortcutsOverlay';
import { ReplitFileExplorer } from '@/components/editor/ReplitFileExplorer';
// Direct imports to avoid loading ALL mobile components via barrel file
import { ReplitMobileNavigation } from '@/components/mobile/ReplitMobileNavigation';
import { ReplitMobileInputBar } from '@/components/mobile/ReplitMobileInputBar';
import { ReplitMobileHeader } from '@/components/mobile/ReplitMobileHeader';
import { type MobileTab } from '@/components/mobile/ReplitMobileNavigation';
import { ReplitBottomTabs } from '@/components/mobile/ReplitBottomTabs';
import {
  FileExplorerSkeleton, EditorSkeleton, TerminalSkeleton,
  PreviewSkeleton, AgentSkeleton, DeploySkeleton,
  MobileLoadingSkeleton
} from '@/components/mobile/MobileLoadingSkeleton';
import { MobileCodeKeyboard } from '@/components/mobile/MobileCodeKeyboard';
import { MobileEmptyState } from '@/components/mobile/MobileEmptyState';
import { PageTransition, BottomSheet, MobileModal } from '@/components/mobile/MobileTransitions';

const MobileTerminal = instrumentedLazy(() => import('@/components/mobile/MobileTerminal').then(mod => ({ default: mod.MobileTerminal })), 'MobileTerminal');

const ReplitMonacoEditor = instrumentedLazy(() => import('@/components/editor/ReplitMonacoEditor').then(mod => ({ default: mod.ReplitMonacoEditor })), 'ReplitMonacoEditor');
const ReplitTerminalPanel = instrumentedLazy(() => import('@/components/editor/ReplitTerminalPanel').then(mod => ({ default: mod.ReplitTerminalPanel })), 'ReplitTerminalPanel');
const ReplitDeploymentPanel = instrumentedLazy(() => import('@/components/ide/ReplitDeploymentPanel').then(mod => ({ default: mod.ReplitDeploymentPanel })), 'ReplitDeploymentPanel');
import { ReplitAgentPanelV3 } from '@/components/ai/ReplitAgentPanelV3';
import { AgentPanelErrorBoundary } from '@/components/ai/AgentPanelErrorBoundary';
import { OptimizedErrorBoundary } from '@/components/OptimizedErrorBoundary';
import type { ExternalInputHandlers } from '@/components/ai/ReplitAgentPanelV3';
const ResponsiveWebPreview = instrumentedLazy(() => import('@/components/editor/ResponsiveWebPreview').then(mod => ({ default: mod.ResponsiveWebPreview })), 'ResponsiveWebPreview');

const EnhancedMobileFileExplorer = instrumentedLazy(() => import('@/components/mobile/EnhancedMobileFileExplorer').then(mod => ({ default: mod.EnhancedMobileFileExplorer })), 'EnhancedMobileFileExplorer');
const LazyMobileCodeEditor = instrumentedLazy(() => import('@/components/mobile/LazyMobileCodeEditor').then(mod => ({ default: mod.LazyMobileCodeEditor })), 'LazyMobileCodeEditor');
const EnhancedMobileTerminal = instrumentedLazy(() => import('@/components/mobile/EnhancedMobileTerminal').then(mod => ({ default: mod.EnhancedMobileTerminal })), 'EnhancedMobileTerminal');
const MobilePreviewPanel = instrumentedLazy(() => import('@/components/mobile/MobilePreviewPanel').then(mod => ({ default: mod.MobilePreviewPanel })), 'MobilePreviewPanel');
const MobileMoreMenu = instrumentedLazy(() => import('@/components/mobile/MobileMoreMenu').then(mod => ({ default: mod.MobileMoreMenu })), 'MobileMoreMenu');
const MobileSecurityPanel = instrumentedLazy(() => import('@/components/mobile/MobileSecurityPanel').then(mod => ({ default: mod.MobileSecurityPanel })), 'MobileSecurityPanel');
const MobileTabSwitcher = instrumentedLazy(() => import('@/components/mobile/MobileTabSwitcher').then(mod => ({ default: mod.MobileTabSwitcher })), 'MobileTabSwitcher');

// Mobile-optimized panels (touch-first design from E-Code-Old)
const MobileGitPanel = instrumentedLazy(() => import('@/components/mobile/MobileGitPanel').then(mod => ({ default: mod.MobileGitPanel })), 'MobileGitPanel');
const MobileDatabasePanel = instrumentedLazy(() => import('@/components/mobile/MobileDatabasePanel').then(mod => ({ default: mod.MobileDatabasePanel })), 'MobileDatabasePanel');
const MobileDebugPanel = instrumentedLazy(() => import('@/components/mobile/MobileDebugPanel').then(mod => ({ default: mod.MobileDebugPanel })), 'MobileDebugPanel');
const MobileDeployPanel = instrumentedLazy(() => import('@/components/mobile/MobileDeployPanel').then(mod => ({ default: mod.MobileDeployPanel })), 'MobileDeployPanel');
const MobilePackagesPanel = instrumentedLazy(() => import('@/components/mobile/MobilePackagesPanel').then(mod => ({ default: mod.MobilePackagesPanel })), 'MobilePackagesPanel');
const MobileSecretsPanel = instrumentedLazy(() => import('@/components/mobile/MobileSecretsPanel').then(mod => ({ default: mod.MobileSecretsPanel })), 'MobileSecretsPanel');
const MobileCollaborationPanel = instrumentedLazy(() => import('@/components/mobile/MobileCollaborationPanel').then(mod => ({ default: mod.MobileCollaborationPanel })), 'MobileCollaborationPanel');
const MobileSessionsPanel = instrumentedLazy(() => import('@/components/mobile/MobileSessionsPanel').then(mod => ({ default: mod.MobileSessionsPanel })), 'MobileSessionsPanel');
const MobileBuildDashboard = instrumentedLazy(() => import('@/components/mobile/MobileBuildDashboard').then(mod => ({ default: mod.MobileBuildDashboard })), 'MobileBuildDashboard');
const MobileSearch = instrumentedLazy(() => import('@/components/mobile/MobileSearch').then(mod => ({ default: mod.MobileSearch })), 'MobileSearch');
const MobileNotifications = instrumentedLazy(() => import('@/components/mobile/MobileNotifications').then(mod => ({ default: mod.MobileNotifications })), 'MobileNotifications');
const MobileSlidePanel = instrumentedLazy(() => import('@/components/mobile/MobileSlidePanel').then(mod => ({ default: mod.MobileSlidePanel })), 'MobileSlidePanel');
const EnhancedMobileCodeEditor = instrumentedLazy(() => import('@/components/mobile/EnhancedMobileCodeEditor').then(mod => ({ default: mod.EnhancedMobileCodeEditor })), 'EnhancedMobileCodeEditor');
const InlineMobileFileExplorer = instrumentedLazy(() => import('@/components/mobile/InlineMobileFileExplorer').then(mod => ({ default: mod.InlineMobileFileExplorer })), 'InlineMobileFileExplorer');
const MobileCodeActions = instrumentedLazy(() => import('@/components/mobile/MobileCodeActions').then(mod => ({ default: mod.MobileCodeActions })), 'MobileCodeActions');
const MobileProfile = instrumentedLazy(() => import('@/components/mobile/MobileProfile').then(mod => ({ default: mod.MobileProfile })), 'MobileProfile');
const MobileIDEHeader = instrumentedLazy(() => import('@/components/mobile/MobileIDEHeader').then(mod => ({ default: mod.MobileIDEHeader })), 'MobileIDEHeader');
const VirtualFileTree = instrumentedLazy(() => import('@/components/mobile/VirtualFileTree').then(mod => ({ default: mod.VirtualFileTree })), 'VirtualFileTree');

const CommandPalette = instrumentedLazy(() => import('@/components/CommandPalette').then(mod => ({ default: mod.CommandPalette })), 'CommandPalette');
const GlobalSearch = instrumentedLazy(() => import('@/components/GlobalSearch').then(mod => ({ default: mod.GlobalSearch })), 'GlobalSearch');
const CollaborationPanel = instrumentedLazy(() => import('@/components/CollaborationPanel').then(mod => ({ default: mod.CollaborationPanel })), 'CollaborationPanel');
const DatabasePanel = instrumentedLazy(() => import('@/components/ide/DatabasePanel').then(mod => ({ default: mod.DatabasePanel })), 'DatabasePanel');
const ReplitAuthPanel = instrumentedLazy(() => import('@/components/ide/ReplitAuthPanel').then(mod => ({ default: mod.ReplitAuthPanel })), 'ReplitAuthPanel');
const AutonomousWorkspaceViewer = instrumentedLazy(() => import('@/components/ide/AutonomousWorkspaceViewer'), 'AutonomousWorkspaceViewer');

const ReplitGitPanel = instrumentedLazy(() => import('@/components/editor/ReplitGitPanel').then(mod => ({ default: mod.ReplitGitPanel })), 'ReplitGitPanel');
const ReplitPackagesPanel = instrumentedLazy(() => import('@/components/editor/ReplitPackagesPanel').then(mod => ({ default: mod.ReplitPackagesPanel })), 'ReplitPackagesPanel');
const ReplitDebuggerPanel = instrumentedLazy(() => import('@/components/editor/ReplitDebuggerPanel').then(mod => ({ default: mod.ReplitDebuggerPanel })), 'ReplitDebuggerPanel');
const ReplitTestingPanel = instrumentedLazy(() => import('@/components/editor/ReplitTestingPanel').then(mod => ({ default: mod.ReplitTestingPanel })), 'ReplitTestingPanel');
const ReplitSecretsPanel = instrumentedLazy(() => import('@/components/editor/ReplitSecretsPanel').then(mod => ({ default: mod.ReplitSecretsPanel })), 'ReplitSecretsPanel');
const ReplitHistoryPanel = instrumentedLazy(() => import('@/components/editor/ReplitHistoryPanel').then(mod => ({ default: mod.ReplitHistoryPanel })), 'ReplitHistoryPanel');
const UnifiedCheckpointsPanel = instrumentedLazy(() => import('@/components/UnifiedCheckpointsPanel').then(mod => ({ default: mod.UnifiedCheckpointsPanel })), 'UnifiedCheckpointsPanel');
const ReplitSettingsPanel = instrumentedLazy(() => import('@/components/editor/ReplitSettingsPanel').then(mod => ({ default: mod.ReplitSettingsPanel })), 'ReplitSettingsPanel');
const ReplitThemesPanel = instrumentedLazy(() => import('@/components/editor/ReplitThemesPanel').then(mod => ({ default: mod.ReplitThemesPanel })), 'ReplitThemesPanel');
const ReplitMultiplayers = instrumentedLazy(() => import('@/components/editor/ReplitMultiplayers').then(mod => ({ default: mod.ReplitMultiplayers })), 'ReplitMultiplayers');
const WorkflowsPanel = instrumentedLazy(() => import('@/components/ide/WorkflowsPanel').then(mod => ({ default: mod.WorkflowsPanel })), 'WorkflowsPanel');
const ExtensionsMarketplace = instrumentedLazy(() => import('@/components/ExtensionsMarketplace').then(mod => ({ default: mod.ExtensionsMarketplace })), 'ExtensionsMarketplace');
const VisualEditorPanel = instrumentedLazy(() => import('@/components/ide/VisualEditorPanel').then(mod => ({ default: mod.VisualEditorPanel })), 'VisualEditorPanel');
const ShellPanel = instrumentedLazy(() => import('@/components/editor/ShellPanel').then(mod => ({ default: mod.ShellPanel })), 'ShellPanel');
const AppStoragePanel = instrumentedLazy(() => import('@/components/editor/AppStoragePanel').then(mod => ({ default: mod.AppStoragePanel })), 'AppStoragePanel');
const ReplitConsolePanel = instrumentedLazy(() => import('@/components/ide/ReplitConsolePanel').then(mod => ({ default: mod.ReplitConsolePanel })), 'ReplitConsolePanel');
const ResourcesPanel = instrumentedLazy(() => import('@/components/ide/ResourcesPanel').then(mod => ({ default: mod.ResourcesPanel })), 'ResourcesPanel');
const LogsViewerPanel = instrumentedLazy(() => import('@/components/ide/LogsViewerPanel').then(mod => ({ default: mod.LogsViewerPanel })), 'LogsViewerPanel');

import { ShortcutHint, ShortcutTester } from '@/components/utilities';
import { useAutonomousBuildStore } from '@/stores/autonomousBuildStore';
import { AgentEventBus } from '@/lib/agentEvents';
import { useElectronMenuEvents } from '@/hooks/useElectron';
import { useSchemaWarmingStore } from '@/stores/schemaWarmingStore';
import { AppNotReadyPlaceholder } from '@/components/mobile/AppNotReadyPlaceholder';

// Specialized editors
const SlideEditor = instrumentedLazy(() => import('@/components/SlideEditor').then(m => m.default ? m : { default: m.SlideEditor || m }), 'SlideEditor');
const VideoEditor = instrumentedLazy(() => import('@/components/VideoEditor').then(m => m.default ? m : { default: m.VideoEditor || m }), 'VideoEditor');
const AnimationPreview = instrumentedLazy(() => import('@/components/AnimationPreview').then(m => m.default ? m : { default: m.AnimationPreview || m }), 'AnimationPreview');
const DesignCanvas = instrumentedLazy(() => import('@/components/DesignCanvas').then(m => m.default ? m : { default: m.DesignCanvas || m }), 'DesignCanvas');
const ConversionDialog = instrumentedLazy(() => import('@/components/ConversionDialog').then(m => m.default ? m : { default: m.ConversionDialog || m }), 'ConversionDialog');

// Re-integrated panels from legacy layout
const AutomationsPanel = instrumentedLazy(() => import('@/components/AutomationsPanel').then(m => m.default ? m : { default: m.AutomationsPanel || m }), 'AutomationsPanel');
const BackupRecoverySection = instrumentedLazy(() => import('@/components/BackupRecoverySection').then(m => m.default ? m : { default: m.BackupRecoverySection || m }), 'BackupRecoverySection');
const ConfigPanel = instrumentedLazy(() => import('@/components/ConfigPanel').then(m => m.default ? m : { default: m.ConfigPanel || m }), 'ConfigPanel');
const FeedbackInboxPanel = instrumentedLazy(() => import('@/components/FeedbackInboxPanel').then(m => m.default ? m : { default: m.FeedbackInboxPanel || m }), 'FeedbackInboxPanel');
const GitHubPanel = instrumentedLazy(() => import('@/components/GitHubPanel').then(m => m.default ? m : { default: m.GitHubPanel || m }), 'GitHubPanel');
const IntegrationsPanel = instrumentedLazy(() => import('@/components/IntegrationsPanel').then(m => m.default ? m : { default: m.IntegrationsPanel || m }), 'IntegrationsPanel');
const MCPPanel = instrumentedLazy(() => import('@/components/MCPPanel').then(m => m.default ? m : { default: m.MCPPanel || m }), 'MCPPanel');
const MergeConflictPanel = instrumentedLazy(() => import('@/components/MergeConflictPanel').then(m => m.default ? m : { default: m.MergeConflictPanel || m }), 'MergeConflictPanel');
const MonitoringPanel = instrumentedLazy(() => import('@/components/MonitoringPanel').then(m => m.default ? m : { default: m.MonitoringPanel || m }), 'MonitoringPanel');
const NetworkingPanel = instrumentedLazy(() => import('@/components/NetworkingPanel').then(m => m.default ? m : { default: m.NetworkingPanel || m }), 'NetworkingPanel');
const SkillsPanel = instrumentedLazy(() => import('@/components/SkillsPanel').then(m => m.default ? m : { default: m.SkillsPanel || m }), 'SkillsPanel');
const SSHPanel = instrumentedLazy(() => import('@/components/SSHPanel').then(m => m.default ? m : { default: m.SSHPanel || m }), 'SSHPanel');
const ThreadsPanel = instrumentedLazy(() => import('@/components/ThreadsPanel').then(m => m.default ? m : { default: m.ThreadsPanel || m }), 'ThreadsPanel');
const TestRunnerPanel = instrumentedLazy(() => import('@/components/TestRunnerPanel').then(m => m.default ? m : { default: m.TestRunnerPanel || m }), 'TestRunnerPanel');
const SecurityScannerPanel = instrumentedLazy(() => import('@/components/SecurityScannerPanel').then(m => m.default ? m : { default: m.SecurityScannerPanel || m }), 'SecurityScannerPanel');
const ReplitProblemsPanel = instrumentedLazy(() => import('@/components/editor/ReplitProblemsPanel').then(m => ({ default: m.ReplitProblemsPanel })), 'ReplitProblemsPanel');
const ReplitOutputPanel = instrumentedLazy(() => import('@/components/editor/ReplitOutputPanel').then(m => ({ default: m.ReplitOutputPanel })), 'ReplitOutputPanel');
const BillingSystem = instrumentedLazy(() => import('@/components/BillingSystem').then(m => ({ default: m.BillingSystem })), 'BillingSystem');
const ReplitDeploymentPipeline = instrumentedLazy(() => import('@/components/ReplitDeploymentPipeline').then(m => ({ default: m.ReplitDeploymentPipeline })), 'ReplitDeploymentPipeline');
const ObjectStoragePanel = instrumentedLazy(() => import('@/components/ObjectStorage').then(m => ({ default: m.ObjectStorage })), 'ObjectStoragePanel');
const ResourceMonitorPanel = instrumentedLazy(() => import('@/components/ResourceMonitor').then(m => ({ default: m.ResourceMonitor })), 'ResourceMonitorPanel');

interface UnifiedIDELayoutProps {
  projectId: string;
  className?: string;
  bootstrapToken?: string | null;
  onWorkspaceComplete?: () => void;
  onWorkspaceError?: (error: string) => void;
  // ✅ FIX (Dec 25, 2025): Callback when agent bootstrap fails (clears token to exit loading)
  onBootstrapFailure?: () => void;
}

type TabletPanel = 'editor' | 'terminal' | 'preview' | 'agent' | 'more';

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 0.3;

const mobileTabOrder: MobileTab[] = ['preview', 'agent', 'deploy', 'more'];

function ProgressPanel({ projectId }: { projectId: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [tasksRes, wfRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/tasks`, { credentials: 'include' }).catch(() => null),
          fetch(`/api/workflows?projectId=${encodeURIComponent(projectId)}`, { credentials: 'include' }).catch(() => null),
        ]);
        if (cancelled) return;
        const tasksData = tasksRes?.ok ? await tasksRes.json() : [];
        const wfData = wfRes?.ok ? await wfRes.json() : [];
        setTasks(Array.isArray(tasksData) ? tasksData : tasksData?.tasks || []);
        setWorkflows(Array.isArray(wfData) ? wfData : wfData?.workflows || []);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    const interval = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [projectId]);

  const activeTasks = tasks.filter((t: any) => t.status === 'in_progress' || t.status === 'pending');
  const completedTasks = tasks.filter((t: any) => t.status === 'completed' || t.status === 'done');
  const runningWorkflows = workflows.filter((w: any) => w.status === 'running');

  return (
    <div className="h-full overflow-auto p-4 space-y-3">
      <h2 className="text-[15px] font-semibold" data-testid="text-progress-title">Progress</h2>
      {loading ? (
        <div className="flex items-center justify-center h-20"><ECodeLoading size="sm" /></div>
      ) : (
        <div className="space-y-3">
          {runningWorkflows.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Running Workflows</h3>
              {runningWorkflows.map((w: any, i: number) => (
                <div key={w.id || i} className="flex items-center gap-2 text-[12px] border border-border rounded-lg p-3" data-testid={`workflow-item-${i}`}>
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                  <span className="font-medium">{w.name || w.command || 'Workflow'}</span>
                  <span className="text-muted-foreground ml-auto">{w.status}</span>
                </div>
              ))}
            </div>
          )}
          {activeTasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Active Tasks</h3>
              {activeTasks.map((t: any, i: number) => (
                <div key={t.id || i} className="flex items-center gap-2 text-[12px] border border-border rounded-lg p-3" data-testid={`task-item-${i}`}>
                  <div className={cn("w-2 h-2 rounded-full shrink-0", t.status === 'in_progress' ? 'bg-amber-500 animate-pulse' : 'bg-gray-400')} />
                  <span className="font-medium truncate">{t.title || t.description || 'Task'}</span>
                  <span className="text-muted-foreground ml-auto capitalize">{t.status?.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          )}
          {completedTasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Completed ({completedTasks.length})</h3>
              {completedTasks.slice(0, 5).map((t: any, i: number) => (
                <div key={t.id || i} className="flex items-center gap-2 text-[12px] text-muted-foreground border border-border/50 rounded-lg p-2.5">
                  <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="truncate">{t.title || t.description || 'Task'}</span>
                </div>
              ))}
            </div>
          )}
          {activeTasks.length === 0 && runningWorkflows.length === 0 && completedTasks.length === 0 && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground border border-border rounded-lg p-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>No active tasks. Start the AI agent or run a workflow to track progress.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SessionReplayPanel({ projectId }: { projectId: string }) {
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCp, setSelectedCp] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}/checkpoints`, { credentials: 'include' });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setCheckpoints(Array.isArray(data) ? data : data?.checkpoints || []);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  return (
    <div className="h-full overflow-auto p-4 space-y-3">
      <h2 className="text-[15px] font-semibold" data-testid="text-session-replay-title">Session Replay</h2>
      {loading ? (
        <div className="flex items-center justify-center h-20"><ECodeLoading size="sm" /></div>
      ) : checkpoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-center">
          <Monitor className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-[12px] text-muted-foreground">No session snapshots yet.</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">Checkpoints created by the AI agent or manually will appear here as a visual timeline.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">{checkpoints.length} checkpoint(s) available</p>
          <div className="relative pl-4 border-l-2 border-border space-y-3">
            {checkpoints.slice(0, 20).map((cp: any, i: number) => {
              const ts = cp.createdAt || cp.timestamp;
              const label = cp.label || cp.description || cp.message || `Checkpoint ${i + 1}`;
              return (
                <button
                  key={cp.id || i}
                  onClick={() => setSelectedCp(selectedCp?.id === cp.id ? null : cp)}
                  className={cn(
                    "relative w-full text-left p-2.5 rounded-lg border transition-colors text-[12px]",
                    selectedCp?.id === cp.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  )}
                  data-testid={`checkpoint-item-${i}`}
                >
                  <div className="absolute -left-[1.35rem] top-3 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                  <div className="font-medium truncate">{label}</div>
                  {ts && <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(ts).toLocaleString()}</div>}
                  {cp.filesChanged && <div className="text-[10px] text-muted-foreground">{cp.filesChanged} file(s) changed</div>}
                </button>
              );
            })}
          </div>
          {selectedCp && (
            <div className="mt-3 p-3 border border-border rounded-lg bg-surface-solid text-[12px] space-y-2">
              <div className="font-medium">Checkpoint Details</div>
              {selectedCp.description && <p className="text-muted-foreground">{selectedCp.description}</p>}
              {selectedCp.files && <p className="text-muted-foreground">Files: {Array.isArray(selectedCp.files) ? selectedCp.files.length : 'N/A'}</p>}
              <div className="text-[10px] text-muted-foreground">ID: {selectedCp.id}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UnifiedIDELayout({ 
  projectId, 
  className,
  bootstrapToken,
  onWorkspaceComplete,
  onWorkspaceError,
  onBootstrapFailure,
}: UnifiedIDELayoutProps) {
  const deviceType = useDeviceType();
  const { toast } = useToast();
  const connectionStatus = useConnectionStatus();
  const isConnected = connectionStatus.isOnline && connectionStatus.backendHealthy;
  const { errorsCount } = useProblemsCount(projectId);
  
  // Autonomous build store for inline chat integration and preview splash screens
  const autonomousBuildStore = useAutonomousBuildStore();
  
  // Schema warming store - shows "App not ready" placeholder until schema is ready
  const { isReady: isSchemaReady } = useSchemaWarmingStore();
  
  const workspace = useIDEWorkspace(projectId);

  const {
    project,
    projectLanguage,
    projectName,
    projectDescription,
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

    filesRaw,
    // Real integrations
    activeFileId,
    activeFileName,
    activeFileContent,
    activeFileLanguage,
    fileContents,
    dirtyFiles,
    handleCodeChange,
    handleCursorChange,
    formatDocument,
    isFormatting,
    lintDiagnostics,
    wsConnected,
    wsStatus,
    livePreviewUrl,
    connectionQuality,
    remoteUsers,
    activeYtext,
    remoteAwareness,
    collabConnected,
    logs,
    currentConsoleRunId,
    pendingAIMessage,
    setPendingAIMessage,
    userPrefs,
    creditBalance,
    // New exports
    updateProjectMutation,
    visibilityMutation,
    inviteGuestMutation,
    removeGuestMutation,
    frameworkPublishMutation,
    frameworkUnpublishMutation,
    deploySettingsMutation,
    forkMutation,
    uploadFileMutation,
    createArtifactMutation,
    applyVisualEditMutation,
    // Workspace management
    wsLoading,
    runnerOnline,
    handleStartWorkspace,
    handleStopWorkspace,
    // Visual editor
    visualEditorActive,
    selectedVEElement,
    setSelectedVEElement,
    handleVisualEditorToggle,
    // Dialog state
    projectSettingsOpen,
    setProjectSettingsOpen,
    publishDialogOpen,
    setPublishDialogOpen,
    inviteDialogOpen,
    setInviteDialogOpen,
    inviteLink,
    inviteLinkCopied,
    inviteLoading,
    handleGenerateInviteLink,
    handleCopyInviteLink,
    copyShareUrl,
    animationExportOpen,
    setAnimationExportOpen,
    conversionDialogOpen,
    setConversionDialogOpen,
    conversionFrameId,
    conversionFrameName,
    conversionTargetType,
    addArtifactDialogOpen,
    setAddArtifactDialogOpen,
    newArtifactName,
    setNewArtifactName,
    newArtifactType,
    setNewArtifactType,
    // Framework
    frameworkCheckbox,
    setFrameworkCheckbox,
    frameworkDesc,
    setFrameworkDesc,
    frameworkCategory,
    setFrameworkCategory,
    frameworkCoverUrl,
    setFrameworkCoverUrl,
    // Deploy dialog
    deployIsPrivate,
    setDeployIsPrivate,
    deployInviteEmail,
    setDeployInviteEmail,
    // Project settings form
    projectNameInput,
    setProjectNameInput,
    projectLangInput,
    setProjectLangInput,
    // Guests
    guestsQuery,
    // Workspace mode
    workspaceMode,
    setWorkspaceMode,
    // Split editor
    splitEditorFileId,
    setSplitEditorFileId,
    // Git blame
    blameEnabled,
    setBlameEnabled,
    blameData,
    // Merge conflicts
    mergeConflicts,
    setMergeConflicts,
    mergeResolutions,
    setMergeResolutions,
    
    handleRunStop,
    handleAddTool,
  } = workspace;

  const handleActivityItemClick = useCallback((item: ActivityItem) => {
    setActiveActivityItem(item);
    
    switch (item) {
      case 'files':
        setShowFileExplorer((prev: boolean) => !prev);
        break;
      case 'search':
        // Open global search as inline tab
        handleAddTool('search');
        break;
      case 'git':
        // Open git as inline tab instead of overlay
        handleAddTool('git');
        break;
      case 'packages':
        // Open packages as inline tab instead of overlay
        handleAddTool('packages');
        break;
      case 'debug':
        // Open debugger as inline tab instead of overlay
        handleAddTool('debugger');
        break;
      case 'terminal':
        handleAddTool('terminal');
        break;
      case 'agent':
        setIsSidebarCollapsed(false);
        setLeftPanelTab('agent');
        break;
      case 'deploy':
        // Open deployment as inline tab
        handleAddTool('deployment');
        break;
      case 'secrets':
        // Open secrets as inline tab instead of overlay
        handleAddTool('secrets');
        break;
      case 'database':
        // Open database as inline tab instead of overlay
        handleAddTool('database');
        break;
      case 'preview':
        handleAddTool('preview');
        break;
      case 'workflows':
        // Open workflows as inline tab instead of overlay
        handleAddTool('workflows');
        break;
      case 'history':
        // Open history as inline tab instead of overlay
        handleAddTool('history');
        break;
      case 'extensions':
        // Open extensions as inline tab instead of overlay
        handleAddTool('extensions');
        break;
      case 'settings':
        handleAddTool('settings');
        break;
      case 'monitoring':
        handleAddTool('monitoring');
        break;
      case 'integrations':
        handleAddTool('integrations');
        break;
      case 'checkpoints':
        handleAddTool('checkpoints');
        break;
      case 'mcp':
        handleAddTool('mcp');
        break;
      case 'ssh':
        handleAddTool('ssh');
        break;
      case 'security-scanner':
        handleAddTool('security-scanner');
        break;
      case 'collaboration':
        handleAddTool('collaboration');
        break;
    }
  }, [setActiveActivityItem, setShowFileExplorer, setIsSidebarCollapsed, setLeftPanelTab, handleAddTool]);

  const [mobileActiveTab, setMobileActiveTab] = useState<MobileTab>('agent');
  const [tabletPanel, setTabletPanel] = useState<TabletPanel>('editor');
  const [tabletDrawerOpen, setTabletDrawerOpen] = useState(true);

  useEffect(() => {
    const landscapeQuery = window.matchMedia('(min-width: 768px) and (max-width: 1024px) and (orientation: landscape)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        setTabletDrawerOpen(true);
      }
    };
    handleChange(landscapeQuery);
    landscapeQuery.addEventListener('change', handleChange);
    return () => landscapeQuery.removeEventListener('change', handleChange);
  }, []);
  
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [enableShortcutHint, setEnableShortcutHint] = useState(false);
  const [enableShortcutTester, setEnableShortcutTester] = useState(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  const [showTabSwitcher, setShowTabSwitcher] = useState(false);
  
  // Tab content transition animation state (Fortune 500 level)
  // displayedTab holds the tab ID whose content is currently rendered
  // This allows us to fade out the OLD content before switching to new
  const [displayedTab, setDisplayedTab] = useState(activeTab);
  const [tabContentVisible, setTabContentVisible] = useState(true);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Check for reduced motion preference (accessibility compliance)
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  }, []);
  
  // Smooth tab transition with accessibility and performance optimizations
  useEffect(() => {
    if (displayedTab !== activeTab) {
      // Clear any pending transition (debounce rapid tab switches)
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      
      // Accessibility: Instant switch if user prefers reduced motion
      if (prefersReducedMotion) {
        setDisplayedTab(activeTab);
        setTabContentVisible(true); // Ensure content stays visible
        return;
      }
      
      // Phase 1: Fade out current content
      setTabContentVisible(false);
      
      // Phase 2: After fade out (100ms), switch to new tab and fade in
      transitionTimerRef.current = setTimeout(() => {
        setDisplayedTab(activeTab);
        setTabContentVisible(true);
        transitionTimerRef.current = null;
      }, 100);
    }
    
    // Cleanup: Only clear if a timer was scheduled
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };
  }, [activeTab, displayedTab, prefersReducedMotion]);
  
  // Open tabs for mobile navigation - tracks which tools are open as tabs
  // Core tabs (Preview, Agent, Deploy) are always visible like Replit's mobile IDE
  interface OpenTab {
    id: string;
    name: string;
    icon: string;
  }
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([
    { id: 'preview', name: 'Preview', icon: 'preview' },
    { id: 'agent', name: 'Agent', icon: 'agent' },
    { id: 'deploy', name: 'Deploy', icon: 'deploy' },
  ]);
  const [activeOpenTabId, setActiveOpenTabId] = useState('preview');
  
  // Mobile agent input handlers - exposed from ReplitAgentPanelV3 to ReplitMobileInputBar
  const [mobileAgentHandlers, setMobileAgentHandlers] = useState<ExternalInputHandlers | null>(null);

  // Open preview tab by default on desktop
  const previewOpenedRef = useRef(false);
  useEffect(() => {
    if (previewOpenedRef.current || deviceType !== 'desktop') return;
    previewOpenedRef.current = true;
    handleAddTool('preview');
  }, [deviceType, handleAddTool]);

  // Force agent tab when bootstrapToken is present for inline chat experience
  useEffect(() => {
    if (bootstrapToken) {
      setLeftPanelTab('agent');
      setMobileActiveTab('agent');
      setIsSidebarCollapsed(false);
    }
  }, [bootstrapToken, setLeftPanelTab, setIsSidebarCollapsed]);

  const [bootstrapPendingMessage, setBootstrapPendingMessage] = useState<string | null>(() => {
    if (!projectId) return null;
    const saved = sessionStorage.getItem(`agent-prompt-${projectId}`);
    return saved || null;
  });
  useEffect(() => {
    if (!projectId || bootstrapPendingMessage) return;
    const savedPrompt = sessionStorage.getItem(`agent-prompt-${projectId}`);
    if (savedPrompt) {
      setBootstrapPendingMessage(savedPrompt);
      setMobileActiveTab('agent');
      setLeftPanelTab('agent');
    }
  }, [projectId, bootstrapPendingMessage, setMobileActiveTab, setLeftPanelTab]);

  const mobileAgentHandlersRef = useRef<ExternalInputHandlers | null>(null);
  useEffect(() => {
    mobileAgentHandlersRef.current = mobileAgentHandlers;
  }, [mobileAgentHandlers]);

  // Tool name mapping for display
  const toolNameMap: Record<string, string> = {
    agent: 'Agent', preview: 'Preview', deploy: 'Deploy', console: 'Console',
    database: 'Database', git: 'Git', secrets: 'Secrets', auth: 'Auth',
    settings: 'Settings', history: 'History', workflows: 'Workflows',
    extensions: 'Extensions', packages: 'Packages', terminal: 'Terminal',
    debug: 'Debug', checkpoints: 'Checkpoints', security: 'Security',
    collaboration: 'Collaboration', search: 'Search',
    automations: 'Automations', config: 'Config', feedback: 'Feedback',
    github: 'GitHub', integrations: 'Integrations', mcp: 'MCP',
    'merge-conflicts': 'Merge Conflicts', monitoring: 'Monitoring',
    networking: 'Networking', skills: 'Skills',
    ssh: 'SSH', threads: 'Threads', 'test-runner': 'Test Runner',
    'security-scanner': 'Scanner', backup: 'Backup',
    actions: 'Actions', tools: 'Tools', 'app-storage': 'App Storage'
  };

  // Add a new tab when tool is selected from tools sheet
  const handleAddOpenTab = useCallback((toolId: string) => {
    const existingTab = openTabs.find(t => t.id === toolId);
    if (existingTab) {
      setActiveOpenTabId(toolId);
    } else {
      const newTab: OpenTab = {
        id: toolId,
        name: toolNameMap[toolId] || toolId,
        icon: toolId,
      };
      setOpenTabs(prev => [...prev, newTab]);
      setActiveOpenTabId(toolId);
    }
    
    // Map all tools to mobileActiveTab for panel rendering
    setMobileActiveTab(toolId as MobileTab);
  }, [openTabs]);

  // Auto-switch to preview panel when agent build completes
  useEffect(() => {
    const unsub = AgentEventBus.on('agent:preview-ready', () => {
      if (deviceType === 'mobile') {
        setMobileActiveTab('preview');
        handleAddOpenTab('preview');
      } else {
        handleAddTool('preview');
      }
    });
    return unsub;
  }, [deviceType, handleAddTool, handleAddOpenTab]);

  const closePanel = useCallback((setter: (v: boolean) => void) => {
    setter(false);
    setActiveActivityItem('files');
  }, [setActiveActivityItem]);

  // Close an open tab
  const handleCloseOpenTab = useCallback((tabId: string) => {
    setOpenTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeOpenTabId === tabId && newTabs.length > 0) {
        setActiveOpenTabId(newTabs[newTabs.length - 1].id);
      }
      return newTabs;
    });
  }, [activeOpenTabId]);

  // Select an open tab
  const handleSelectOpenTab = useCallback((tabId: string) => {
    setActiveOpenTabId(tabId);
    // Map all tools to mobileActiveTab for panel rendering
    setMobileActiveTab(tabId as MobileTab);
  }, []);

  // Handle quick access from tab switcher
  const handleQuickAccess = useCallback((toolId: string) => {
    switch (toolId) {
      case 'secrets':
        handleAddOpenTab('secrets');
        break;
      case 'database':
        handleAddOpenTab('database');
        break;
      case 'auth':
        handleAddOpenTab('auth');
        break;
    }
  }, [handleAddOpenTab]);

  // Electron Desktop Menu Event Handlers (5.1 IPC Handlers)
  useElectronMenuEvents({
    onNewProject: () => {
      // Navigate to new project page
      window.location.href = '/';
    },
    onOpenProject: () => {
      setShowQuickFileSearch(true);
    },
    onSave: () => {
      // Trigger save via Monaco editor command
      const event = new CustomEvent('electron-save');
      document.dispatchEvent(event);
      toast({ title: 'File saved', description: 'Your changes have been saved.' });
    },
    onSaveAll: () => {
      // Trigger save all via Monaco editor
      const event = new CustomEvent('electron-save-all');
      document.dispatchEvent(event);
      toast({ title: 'All files saved', description: 'All open files have been saved.' });
    },
    onPreferences: () => {
      handleAddTool('settings');
    },
    onFind: () => {
      // Trigger Monaco find widget
      const event = new CustomEvent('electron-find');
      document.dispatchEvent(event);
    },
    onFindReplace: () => {
      // Trigger Monaco find-replace widget
      const event = new CustomEvent('electron-find-replace');
      document.dispatchEvent(event);
    },
    onNewTerminal: () => {
      handleAddTool('terminal');
    },
    onClearTerminal: () => {
      const event = new CustomEvent('electron-clear-terminal');
      document.dispatchEvent(event);
    },
    onToggleSidebar: () => {
      setShowFileExplorer(prev => !prev);
    },
    onToggleTerminal: () => {
      handleAddTool('terminal');
    },
    onToggleAI: () => {
      setIsSidebarCollapsed(prev => !prev);
      if (isSidebarCollapsed) {
        setLeftPanelTab('agent');
      }
    },
    onQuickOpen: () => {
      setShowQuickFileSearch(true);
    },
    onGoToLine: () => {
      const event = new CustomEvent('electron-go-to-line');
      document.dispatchEvent(event);
    },
    onGoToSymbol: () => {
      const event = new CustomEvent('electron-go-to-symbol');
      document.dispatchEvent(event);
    },
    onGoToDefinition: () => {
      const event = new CustomEvent('electron-go-to-definition');
      document.dispatchEvent(event);
    },
    onRunCode: () => {
      setIsRunning(true);
    },
    onStopExecution: () => {
      setIsRunning(false);
    },
    onShowShortcuts: () => {
      setShowKeyboardShortcuts(true);
    },
  });
  
  const tabletSwipeStartX = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        // Open Global Search tab
        handleAddOpenTab('search');
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setShowQuickFileSearch(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setShowQuickFileSearch, handleAddOpenTab]);

  const mobileSwipeHandlers = useMemo(() => createPanHandlers({
    axis: 'x',
    threshold: SWIPE_THRESHOLD,
    onEnd: (info: PanInfo) => {
      const isSwipeLeft = info.offset.x < -SWIPE_THRESHOLD && Math.abs(info.velocity.x) > SWIPE_VELOCITY_THRESHOLD * 1000;
      const isSwipeRight = info.offset.x > SWIPE_THRESHOLD && Math.abs(info.velocity.x) > SWIPE_VELOCITY_THRESHOLD * 1000;
      
      if (isSwipeLeft || isSwipeRight) {
        const currentIndex = mobileTabOrder.indexOf(mobileActiveTab);
        let newIndex = currentIndex;
        
        if (isSwipeLeft && currentIndex < mobileTabOrder.length - 1) {
          newIndex = currentIndex + 1;
        } else if (isSwipeRight && currentIndex > 0) {
          newIndex = currentIndex - 1;
        }
        
        if (newIndex !== currentIndex) {
          setMobileActiveTab(mobileTabOrder[newIndex]);
          if ('vibrate' in navigator) {
            navigator.vibrate(10);
          }
        }
      }
    }
  }), [mobileActiveTab]);

  const tabletPanHandlers = useMemo(() => createPanHandlers({
    axis: 'x',
    threshold: 20,
    onStart: (info: PanInfo) => {
      tabletSwipeStartX.current = info.point.x;
    },
    onEnd: (info: PanInfo) => {
      const swipeDistance = info.offset.x;
      
      if (!tabletDrawerOpen && tabletSwipeStartX.current < 20 && swipeDistance > 80) {
        setTabletDrawerOpen(true);
        if ('vibrate' in navigator) navigator.vibrate(10);
      } else if (tabletDrawerOpen && swipeDistance < -80) {
        setTabletDrawerOpen(false);
        if ('vibrate' in navigator) navigator.vibrate(10);
      }
    }
  }), [tabletDrawerOpen]);

  const deploymentStatus = publishState?.status === 'live' ? 'live' 
    : publishState?.status === 'publishing' ? 'deploying' 
    : publishState?.status === 'failed' ? 'failed' 
    : 'idle';

  // For mobile and tablet, show navigation even during loading (matches Replit behavior)
  // For desktop, show the full loading screen
  if (isLoadingProject && deviceType === 'desktop') {
    return <ECodeLoading fullScreen size="lg" text="Loading workspace..." />;
  }

  if (!project && !isLoadingProject && !workspace.bootstrapToken) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Project not found or access denied.</p>
          <Button onClick={() => window.location.href = '/'}>Go back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const renderMobileContent = () => {
    // ✅ FIX (Jan 2026): During bootstrap, keep agent panel mounted even if project is loading
    // This prevents WebSocket disconnection when isLoadingProject oscillates
    // The agent panel handles its own loading state during bootstrap
    if (isLoadingProject && !(mobileActiveTab === 'agent' && bootstrapToken)) {
      return <MobileLoadingSkeleton />;
    }
    
    switch (mobileActiveTab) {
      case 'preview':
        // Gate preview with AppNotReadyPlaceholder until schema is ready (bootstrap only)
        if (!isSchemaReady && !!bootstrapToken) {
          return <AppNotReadyPlaceholder tabName="Preview" projectId={projectId} />;
        }
        return (
          <Suspense fallback={<PreviewSkeleton />}>
            <MobilePreviewPanel projectId={projectId} />
          </Suspense>
        );
      case 'agent':
        return (
          <AgentPanelErrorBoundary>
            <ReplitAgentPanelV3
              projectId={projectId}
              mode="mobile"
              agentToolsSettings={agentToolsSettings}
              onAgentToolsSettingsChange={setAgentToolsSettings}
              isBootstrapping={!!bootstrapToken}
              bootstrapToken={bootstrapToken}
              hideInput={true}
              onExternalInput={setMobileAgentHandlers}
              onBootstrapFailure={onBootstrapFailure}
              pendingMessage={bootstrapPendingMessage}
              onPendingMessageConsumed={() => setBootstrapPendingMessage(null)}
            />
          </AgentPanelErrorBoundary>
        );
      case 'deploy':
        // Gate deploy with AppNotReadyPlaceholder until schema is ready (bootstrap only)
        if (!isSchemaReady && !!bootstrapToken) {
          return <AppNotReadyPlaceholder tabName="Deploy" projectId={projectId} />;
        }
        return (
          <Suspense fallback={<DeploySkeleton />}>
            <MobileDeployPanel projectId={projectId} className="h-full" />
          </Suspense>
        );
      case 'git':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <MobileGitPanel projectId={projectId} className="h-full" />
          </Suspense>
        );
      case 'packages':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <MobilePackagesPanel projectId={projectId} className="h-full" />
          </Suspense>
        );
      case 'secrets':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <MobileSecretsPanel projectId={projectId} className="h-full" />
          </Suspense>
        );
      case 'database':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <MobileDatabasePanel projectId={projectId} className="h-full" />
          </Suspense>
        );
      case 'auth':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <ReplitAuthPanel projectId={projectId} />
          </Suspense>
        );
      case 'shell':
        return (
          <Suspense fallback={<TerminalSkeleton />}>
            <ShellPanel projectId={projectId} />
          </Suspense>
        );
      case 'storage':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <AppStoragePanel projectId={projectId} />
          </Suspense>
        );
      case 'terminal':
        return (
          <Suspense fallback={<TerminalSkeleton />}>
            <MobileTerminal projectId={projectId} className="h-full" />
          </Suspense>
        );
      case 'code':
        return (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Editor..." /></div>}>
            <div className="flex flex-col h-full">
              {activeFileId ? (
                <>
                  <div className="flex items-center h-9 px-3 bg-[var(--ide-surface)] border-b border-[var(--ide-border)] shrink-0">
                    <button onClick={() => setMobileActiveTab('files' as MobileTab)} className="mr-2 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" data-testid="btn-back-to-files">
                      <FolderOpen className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-medium text-[var(--ide-text)] truncate" data-testid="text-active-filename">{activeFileName || 'Untitled'}</span>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ReplitMonacoEditor projectId={projectId} fileId={activeFileId} fileContents={fileContents || {}} onCodeChange={handleCodeChange || (() => {})} onCursorChange={handleCursorChange} fontSize={userPrefs?.fontSize} tabSize={userPrefs?.tabSize} wordWrap={userPrefs?.wordWrap} minimap={false} filename={activeFileName || undefined} ytext={activeYtext} remoteAwareness={collabConnected ? remoteAwareness : undefined} />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--ide-text-muted)]" data-testid="text-no-file-selected">
                  <p className="text-sm">Select a file to edit</p>
                </div>
              )}
            </div>
          </Suspense>
        );
      case 'files':
        return (
          <Suspense fallback={<FileExplorerSkeleton />}>
            <InlineMobileFileExplorer
              projectId={projectId}
              onFileSelect={(file) => {
                handleFileSelect({ id: file.id, filename: file.filename });
                setMobileActiveTab('code' as MobileTab);
              }}
              selectedFileId={selectedFileId}
              className="h-full"
            />
          </Suspense>
        );
      case 'history':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <ReplitHistoryPanel projectId={projectId} />
          </Suspense>
        );
      case 'themes':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <ReplitThemesPanel projectId={projectId} />
          </Suspense>
        );
      case 'multiplayers':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <ReplitMultiplayers projectId={projectId} />
          </Suspense>
        );
      case 'checkpoints':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <UnifiedCheckpointsPanel projectId={projectId} maxHeight="calc(100vh - 120px)" />
          </Suspense>
        );
      case 'settings':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <ReplitSettingsPanel projectId={projectId} />
          </Suspense>
        );
      case 'extensions':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <ExtensionsMarketplace projectId={projectId} className="h-full" />
          </Suspense>
        );
      case 'workflows':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <WorkflowsPanel projectId={projectId} />
          </Suspense>
        );
      case 'debug':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <MobileDebugPanel projectId={projectId} className="h-full" />
          </Suspense>
        );
      case 'testing':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <ReplitTestingPanel projectId={projectId} />
          </Suspense>
        );
      case 'security':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <MobileSecurityPanel projectId={projectId} />
          </Suspense>
        );
      case 'collaboration':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <MobileCollaborationPanel
              projectId={parseInt(projectId, 10)}
              projectName={project?.name}
              isOpen={true}
              onClose={() => setMobileActiveTab('agent')}
            />
          </Suspense>
        );
      case 'search':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <MobileSearch
              isOpen={true}
              onClose={() => setMobileActiveTab('agent')}
              onSearch={(query, category) => {
                if (query.trim()) {
                  handleAddTool('search');
                }
              }}
            />
          </Suspense>
        );
      case 'actions':
        return (
          <Suspense fallback={<AgentSkeleton />}>
            <AgentPanelErrorBoundary>
              <ReplitAgentPanelV3
                projectId={projectId}
                mode="mobile"
                agentToolsSettings={agentToolsSettings}
                onAgentToolsSettingsChange={setAgentToolsSettings}
                isBootstrapping={!!bootstrapToken}
                bootstrapToken={bootstrapToken}
                hideInput={true}
                onExternalInput={setMobileAgentHandlers}
                onBootstrapFailure={onBootstrapFailure}
                pendingMessage={bootstrapPendingMessage}
                onPendingMessageConsumed={() => setBootstrapPendingMessage(null)}
              />
            </AgentPanelErrorBoundary>
          </Suspense>
        );
      case 'tools':
        return (
          <Suspense fallback={<AgentSkeleton />}>
            <AgentPanelErrorBoundary>
              <ReplitAgentPanelV3
                projectId={projectId}
                mode="mobile"
                agentToolsSettings={agentToolsSettings}
                onAgentToolsSettingsChange={setAgentToolsSettings}
                isBootstrapping={!!bootstrapToken}
                bootstrapToken={bootstrapToken}
                hideInput={true}
                onExternalInput={setMobileAgentHandlers}
                onBootstrapFailure={onBootstrapFailure}
                pendingMessage={bootstrapPendingMessage}
                onPendingMessageConsumed={() => setBootstrapPendingMessage(null)}
              />
            </AgentPanelErrorBoundary>
          </Suspense>
        );
      case 'sessions':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <MobileSessionsPanel className="h-full" />
          </Suspense>
        );
      case 'build':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <MobileBuildDashboard />
          </Suspense>
        );
      case 'notifications':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <MobileSlidePanel
              isOpen={true}
              onClose={() => setMobileActiveTab('agent')}
              title="Notifications"
            >
              <MobileNotifications />
            </MobileSlidePanel>
          </Suspense>
        );
      case 'profile':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <MobileSlidePanel
              isOpen={true}
              onClose={() => setMobileActiveTab('agent')}
              title="Profile"
            >
              <MobileProfile />
            </MobileSlidePanel>
          </Suspense>
        );
      case 'more':
        return null;
      default:
        return (
          <MobileEmptyState
            variant="no-content"
            title="Panel not available"
            description="This panel is not yet available on mobile."
            action={{
              label: "Back to Agent",
              onClick: () => setMobileActiveTab('agent'),
            }}
          />
        );
    }
  };

  const renderTabletContent = () => {
    switch (tabletPanel) {
      case 'editor':
        return (
          <Suspense fallback={<EditorSkeleton />}>
            <div className="relative h-full">
              <ReplitMonacoEditor
                projectId={projectId}
                fileId={activeFileId || (selectedFileId ? String(selectedFileId) : null)}
                fileContents={fileContents || {}}
                onCodeChange={handleCodeChange || (() => {})}
                onCursorChange={handleCursorChange}
                filename={activeFileName || undefined}
              />
              <MobileCodeActions editor={null} className="absolute bottom-4 right-4 z-20" />
            </div>
          </Suspense>
        );
      case 'terminal':
        return (
          <Suspense fallback={<TerminalSkeleton />}>
            <ReplitTerminalPanel projectId={projectId} />
          </Suspense>
        );
      case 'preview':
        // Gate preview with AppNotReadyPlaceholder until schema is ready (bootstrap only)
        if (!isSchemaReady && !!bootstrapToken) {
          return <AppNotReadyPlaceholder tabName="Preview" projectId={projectId} />;
        }
        return (
          <Suspense fallback={<PreviewSkeleton />}>
            <ResponsiveWebPreview projectId={projectId} />
          </Suspense>
        );
      case 'agent':
        return (
          <Suspense fallback={<AgentSkeleton />}>
            <AgentPanelErrorBoundary>
              <ReplitAgentPanelV3
                projectId={projectId}
                mode="tablet"
                agentToolsSettings={agentToolsSettings}
                onAgentToolsSettingsChange={setAgentToolsSettings}
                isBootstrapping={!!bootstrapToken}
                bootstrapToken={bootstrapToken}
                onBootstrapFailure={onBootstrapFailure}
                pendingMessage={bootstrapPendingMessage}
                onPendingMessageConsumed={() => setBootstrapPendingMessage(null)}
              />
            </AgentPanelErrorBoundary>
          </Suspense>
        );
      case 'more':
        return (
          <Suspense fallback={<MobileLoadingSkeleton />}>
            <MobileMoreMenu
              projectId={projectId}
              isOpen={true}
              inline={true}
              onClose={() => setTabletPanel('editor')}
              onOpenFiles={() => setTabletDrawerOpen(true)}
              onOpenGit={() => { setActiveActivityItem('git'); handleAddTool('git'); setTabletPanel('editor'); }}
              onOpenPackages={() => { setActiveActivityItem('packages'); handleAddTool('packages'); setTabletPanel('editor'); }}
              onOpenSecrets={() => { setActiveActivityItem('secrets'); handleAddTool('secrets'); setTabletPanel('editor'); }}
              onOpenDatabase={() => { setActiveActivityItem('database'); handleAddTool('database'); setTabletPanel('editor'); }}
              onOpenSettings={() => { setActiveActivityItem('settings'); handleAddTool('settings'); setTabletPanel('editor'); }}
              onOpenDebug={() => { setActiveActivityItem('debug'); handleAddTool('debugger'); setTabletPanel('editor'); }}
              onOpenCollaboration={() => { handleAddTool('collaboration'); setTabletPanel('editor'); }}
              onOpenWorkflows={() => { setActiveActivityItem('workflows'); handleAddTool('workflows'); setTabletPanel('editor'); }}
              onOpenHistory={() => { setActiveActivityItem('history'); handleAddTool('history'); setTabletPanel('editor'); }}
              onOpenCheckpoints={() => { handleAddTool('checkpoints'); setTabletPanel('editor'); }}
              onOpenExtensions={() => { setActiveActivityItem('extensions'); handleAddTool('extensions'); setTabletPanel('editor'); }}
              onOpenSecurity={() => { handleAddTool('security'); setTabletPanel('editor'); }}
              onOpenActions={() => { handleAddTool('actions'); setTabletPanel('editor'); }}
              onOpenTools={() => { setShowToolsSheet(true); setTabletPanel('editor'); }}
              onOpenDeploy={() => { handleAddTool('deployment'); setTabletPanel('editor'); }}
              onOpenCommandPalette={() => setShowCommandPalette(true)}
              onOpenGlobalSearch={() => { setIsSidebarCollapsed(false); setLeftPanelTab('agent'); setTabletPanel('agent'); }}
              onOpenQuickFileSearch={() => setShowQuickFileSearch(true)}
              onOpenKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
            />
          </Suspense>
        );
      default:
        return null;
    }
  };

  const renderDesktopContent = () => {
    // Use displayedTab to render content - this shows the OLD tab during fade-out
    const currentTab = tabs.find(t => t.id === displayedTab);
    
    if (!currentTab) {
      return <div className="flex items-center justify-center h-full text-muted-foreground">Select a tab</div>;
    }

    // Preview panel - gate with AppNotReadyPlaceholder until schema is ready (bootstrap only)
    if (currentTab.id === 'preview' || currentTab.id === 'webpreview') {
      if (!isSchemaReady && !!bootstrapToken) {
        return <AppNotReadyPlaceholder tabName="Preview" projectId={projectId} />;
      }
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}>
          <ResponsiveWebPreview projectId={projectId} />
        </Suspense>
      );
    }

    // Console - Read-only runtime output (stdout, stderr, exit codes)
    if (currentTab.id === 'console') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Console..." /></div>}>
          <ReplitConsolePanel projectId={projectId} isRunning={isRunning} executionId={executionId} />
        </Suspense>
      );
    }

    // Shell - Interactive PTY terminal with multi-session support
    if (currentTab.id === 'shell') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Shell..." /></div>}>
          <ShellPanel projectId={projectId} />
        </Suspense>
      );
    }

    // File editor
    if (currentTab.id.startsWith('file:')) {
      const editorFileId = activeFileId || (selectedFileId ? String(selectedFileId) : null);
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center h-7 px-2 bg-[var(--ide-surface)] border-b border-[var(--ide-border)] shrink-0 justify-between">
            <span className="text-[11px] text-[var(--ide-text-muted)] truncate" data-testid="text-editor-filepath">{activeFileName || ''}</span>
            <div className="flex items-center gap-1">
              {formatDocument && (
                <button
                  onClick={formatDocument}
                  disabled={isFormatting}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded hover:bg-[var(--ide-surface-hover)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors disabled:opacity-50"
                  title="Format Document (Prettier)"
                  data-testid="button-format-document"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>
                  {isFormatting ? 'Formatting...' : 'Format'}
                </button>
              )}
            </div>
          </div>
          {lintDiagnostics && lintDiagnostics.length > 0 && (
            <div className="max-h-24 overflow-y-auto bg-[var(--ide-surface)] border-b border-[var(--ide-border)] px-3 py-1" data-testid="lint-diagnostics-panel">
              {lintDiagnostics.map((d: any, i: number) => (
                <div key={i} className={`flex items-start gap-2 text-[11px] py-0.5 ${d.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                  <span className="shrink-0">{d.severity === 'error' ? '●' : '▲'}</span>
                  <span className="text-[var(--ide-text-muted)] shrink-0">Ln {d.line}, Col {d.column}</span>
                  <span className="truncate">{d.message}</span>
                  {d.ruleId && <span className="text-[var(--ide-text-muted)] shrink-0">({d.ruleId})</span>}
                </div>
              ))}
            </div>
          )}
          <div className="flex-1 min-h-0">
            <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}>
              <ReplitMonacoEditor
                projectId={projectId}
                fileId={editorFileId}
                fileContents={fileContents || {}}
                onCodeChange={handleCodeChange || (() => {})}
                onCursorChange={handleCursorChange}
                filename={activeFileName || undefined}
              />
            </Suspense>
          </div>
        </div>
      );
    }

    // Git panel - inline
    if (currentTab.id === 'git') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Git..." /></div>}>
          <ReplitGitPanel projectId={projectId} />
        </Suspense>
      );
    }

    // Packages panel - inline
    if (currentTab.id === 'packages') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Packages..." /></div>}>
          <ReplitPackagesPanel projectId={projectId} />
        </Suspense>
      );
    }

    // Secrets panel - inline
    if (currentTab.id === 'secrets' || currentTab.id === 'env' || currentTab.id === 'env-vars') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Secrets..." /></div>}>
          <ReplitSecretsPanel projectId={projectId} />
        </Suspense>
      );
    }

    // Database panel - inline
    if (currentTab.id === 'database' || currentTab.id === 'database-browser') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Database..." /></div>}>
          <DatabasePanel projectId={projectId} />
        </Suspense>
      );
    }

    // Auth panel - inline
    if (currentTab.id === 'auth') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Auth..." /></div>}>
          <ReplitAuthPanel projectId={projectId} />
        </Suspense>
      );
    }

    // Debug panel - inline
    if (currentTab.id === 'debugger' || currentTab.id === 'debug') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Debugger..." /></div>}>
          <ReplitDebuggerPanel projectId={projectId} />
        </Suspense>
      );
    }

    // Settings panel - inline
    if (currentTab.id === 'settings') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Settings..." /></div>}>
          <ReplitSettingsPanel projectId={projectId} />
        </Suspense>
      );
    }

    // History panel - inline
    if (currentTab.id === 'history' || currentTab.id === 'rewind') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading History..." /></div>}>
          <ReplitHistoryPanel projectId={projectId} />
        </Suspense>
      );
    }

    // Checkpoints panel - inline
    if (currentTab.id === 'checkpoints') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Checkpoints..." /></div>}>
          <UnifiedCheckpointsPanel projectId={projectId} />
        </Suspense>
      );
    }

    // Workflows panel - inline
    if (currentTab.id === 'workflows') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Workflows..." /></div>}>
          <WorkflowsPanel projectId={projectId} />
        </Suspense>
      );
    }

    // Extensions panel - inline
    if (currentTab.id === 'extensions') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Extensions..." /></div>}>
          <ExtensionsMarketplace projectId={projectId} />
        </Suspense>
      );
    }

    // Security panel - inline
    if (currentTab.id === 'security') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Security..." /></div>}>
          <MobileSecurityPanel projectId={projectId} />
        </Suspense>
      );
    }

    // Collaboration panel - inline
    if (currentTab.id === 'collaboration' || currentTab.id === 'multiplayer') {
      return user ? (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Collaboration..." /></div>}>
          <CollaborationPanel
            projectId={parseInt(projectId, 10)}
            currentUser={user}
          />
        </Suspense>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">Please log in to access collaboration</div>
      );
    }

    // Global search - inline
    if (currentTab.id === 'search' || currentTab.id === 'global-search') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Search..." /></div>}>
          <GlobalSearch
            isOpen={true}
            inline={true}
            onClose={() => {}}
            projectId={projectId}
            onFileSelect={(file) => handleFileSelect({ id: file.id, filename: file.filename })}
          />
        </Suspense>
      );
    }

    // Deployment panel - inline
    if (currentTab.id === 'deployment' || currentTab.id === 'deploy') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Deployment..." /></div>}>
          <ReplitDeploymentPanel projectId={projectId} />
        </Suspense>
      );
    }

    // Testing panel - inline
    if (currentTab.id === 'testing' || currentTab.id === 'test-runner') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Tests..." /></div>}>
          <TestRunnerPanel projectId={projectId} onClose={() => handleTabClose(currentTab.id)} />
        </Suspense>
      );
    }

    // Problems panel - inline
    if (currentTab.id === 'problems') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Problems..." /></div>}>
          <ReplitProblemsPanel projectId={projectId} onFileNavigate={(filePath: string) => {
            const file = workspace.files?.find((f: any) => f.path === filePath || f.name === filePath);
            if (file) workspace.openFile?.(file);
          }} />
        </Suspense>
      );
    }

    // Output panel - inline
    if (currentTab.id === 'output') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Output..." /></div>}>
          <ReplitOutputPanel projectId={projectId} />
        </Suspense>
      );
    }

    // Resources panel - inline
    if (currentTab.id === 'resources') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Resources..." /></div>}>
          <ResourcesPanel projectId={projectId} />
        </Suspense>
      );
    }

    // Logs viewer - inline
    if (currentTab.id === 'logs') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Logs..." /></div>}>
          <LogsViewerPanel projectId={projectId} />
        </Suspense>
      );
    }

    // Visual editor - inline
    if (currentTab.id === 'visual-editor') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Visual Editor..." /></div>}>
          <VisualEditorPanel projectId={projectId} />
        </Suspense>
      );
    }

    // AI Assistant - inline (redirects to agent panel)
    if (currentTab.id === 'ai-assistant') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading AI Assistant..." /></div>}>
          <ReplitAgentPanelV3
            projectId={projectId}
            mode="desktop"
            agentToolsSettings={agentToolsSettings}
            onAgentToolsSettingsChange={setAgentToolsSettings}
            pendingMessage={bootstrapPendingMessage}
            onPendingMessageConsumed={() => setBootstrapPendingMessage(null)}
          />
        </Suspense>
      );
    }

    if (currentTab.id === 'progress') {
      return <ProgressPanel projectId={projectId} />;
    }

    if (currentTab.id === 'video-replay') {
      return <SessionReplayPanel projectId={projectId} />;
    }

    if (currentTab.id === 'deployment-pipeline') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Pipeline..." /></div>}>
          <ReplitDeploymentPipeline projectId={projectId} />
        </Suspense>
      );
    }

    // Billing - inline
    if (currentTab.id === 'billing') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Billing..." /></div>}>
          <div className="h-full overflow-auto">
            <BillingSystem userId={workspace.project?.userId || workspace.project?.ownerId || ''} />
          </div>
        </Suspense>
      );
    }

    // Import/Export - inline
    if (currentTab.id === 'import-export') {
      return (
        <div className="h-full overflow-auto p-4 space-y-4">
          <h2 className="text-[15px] font-semibold">Import / Export</h2>
          <div className="space-y-3">
            <div className="border border-border rounded-lg p-4 space-y-2">
              <h3 className="text-[13px] font-medium">Export Project</h3>
              <p className="text-[11px] text-muted-foreground">Download all project files as a ZIP archive.</p>
              <Button size="sm" variant="outline" className="text-[11px]" data-testid="button-export-zip"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/projects/${projectId}/export`, { credentials: 'include' });
                    if (!res.ok) throw new Error('Export failed');
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${workspace.project?.name || 'project'}.zip`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (e: any) {
                    toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
                  }
                }}>
                <Download className="h-3 w-3 mr-1" /> Download ZIP
              </Button>
            </div>
            <div className="border border-border rounded-lg p-4 space-y-2">
              <h3 className="text-[13px] font-medium">Import Files</h3>
              <p className="text-[11px] text-muted-foreground">Upload files or a ZIP archive to add to the project.</p>
              <Button size="sm" variant="outline" className="text-[11px]" data-testid="button-import-files"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.accept = '.zip,.tar,.gz,*';
                  input.onchange = async (ev) => {
                    const files = (ev.target as HTMLInputElement).files;
                    if (!files?.length) return;
                    const formData = new FormData();
                    for (let i = 0; i < files.length; i++) formData.append('files', files[i]);
                    try {
                      const res = await fetch(`/api/projects/${projectId}/import`, { method: 'POST', credentials: 'include', body: formData });
                      if (!res.ok) throw new Error('Import failed');
                      const result = await res.json();
                      toast({ title: 'Files imported successfully', description: `${result.imported} file(s) added` });
                      window.dispatchEvent(new CustomEvent('ecode:files-changed', { detail: { projectId } }));
                    } catch (e: any) {
                      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
                    }
                  };
                  input.click();
                }}>
                <Upload className="h-3 w-3 mr-1" /> Upload Files
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Package viewer - inline
    if (currentTab.id === 'package-viewer') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Package Viewer..." /></div>}>
          <ReplitPackagesPanel projectId={projectId} />
        </Suspense>
      );
    }

    
    if (currentTab.id === 'automations') return <Suspense fallback={<ECodeLoading size="md" />}><AutomationsPanel projectId={projectId} onClose={() => handleTabClose('automations')} /></Suspense>;
    if (currentTab.id === 'backup') return <Suspense fallback={<ECodeLoading size="md" />}><BackupRecoverySection projectId={projectId} /></Suspense>;
    if (currentTab.id === 'config') return <Suspense fallback={<ECodeLoading size="md" />}><ConfigPanel projectId={projectId} onClose={() => handleTabClose('config')} /></Suspense>;
    if (currentTab.id === 'feedback') return <Suspense fallback={<ECodeLoading size="md" />}><FeedbackInboxPanel projectId={projectId} onClose={() => handleTabClose('feedback')} onSendToAI={(text: string) => { setPendingAIMessage?.(text); setIsSidebarCollapsed(false); setLeftPanelTab('agent'); }} /></Suspense>;
    if (currentTab.id === 'github') return <Suspense fallback={<ECodeLoading size="md" />}><GitHubPanel projectId={projectId} projectName={projectName} /></Suspense>;
    if (currentTab.id === 'integrations') return <Suspense fallback={<ECodeLoading size="md" />}><IntegrationsPanel projectId={projectId} onClose={() => handleTabClose('integrations')} /></Suspense>;
    if (currentTab.id === 'mcp') return <Suspense fallback={<ECodeLoading size="md" />}><MCPPanel projectId={projectId} onClose={() => handleTabClose('mcp')} /></Suspense>;
    if (currentTab.id === 'merge-conflicts') return <Suspense fallback={<ECodeLoading size="md" />}><MergeConflictPanel projectId={projectId} conflicts={mergeConflicts || []} resolutions={mergeResolutions || []} onClose={() => handleTabClose('merge-conflicts')} onMergeComplete={() => { setMergeConflicts?.([]); setMergeResolutions?.([]); handleTabClose('merge-conflicts'); }} onAbort={() => { setMergeConflicts?.([]); setMergeResolutions?.([]); handleTabClose('merge-conflicts'); }} onResolutionChange={(updated: any) => setMergeResolutions?.(updated)} /></Suspense>;
    if (currentTab.id === 'monitoring') return <Suspense fallback={<ECodeLoading size="md" />}><MonitoringPanel projectId={projectId} onClose={() => handleTabClose('monitoring')} /></Suspense>;
    if (currentTab.id === 'networking') return <Suspense fallback={<ECodeLoading size="md" />}><NetworkingPanel projectId={projectId} onClose={() => handleTabClose('networking')} /></Suspense>;
    if (currentTab.id === 'skills') return <Suspense fallback={<ECodeLoading size="md" />}><SkillsPanel projectId={projectId} onClose={() => handleTabClose('skills')} /></Suspense>;
    if (currentTab.id === 'ssh') return <Suspense fallback={<ECodeLoading size="md" />}><SSHPanel projectId={projectId} onClose={() => handleTabClose('ssh')} /></Suspense>;
    if (currentTab.id === 'threads') return <Suspense fallback={<ECodeLoading size="md" />}><ThreadsPanel projectId={projectId} onClose={() => handleTabClose('threads')} /></Suspense>;
    if (currentTab.id === 'security-scanner') return <Suspense fallback={<ECodeLoading size="md" />}><SecurityScannerPanel projectId={projectId} onClose={() => handleTabClose('security-scanner')} /></Suspense>;
    if (currentTab.id === 'slides') return <Suspense fallback={<ECodeLoading size="md" />}><SlideEditor projectId={projectId} /></Suspense>;
    if (currentTab.id === 'video') return <Suspense fallback={<ECodeLoading size="md" />}><VideoEditor projectId={projectId} /></Suspense>;
    if (currentTab.id === 'animation') return <Suspense fallback={<ECodeLoading size="md" />}><AnimationPreview projectId={projectId} previewUrl={livePreviewUrl} exportDialogOpen={animationExportOpen} onExportDialogClose={() => setAnimationExportOpen?.(false)} /></Suspense>;
    if (currentTab.id === 'design') return <Suspense fallback={<ECodeLoading size="md" />}><DesignCanvas projectId={projectId} /></Suspense>;

    if (currentTab.id === 'authentication') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Auth..." /></div>}>
          <ReplitAuthPanel projectId={projectId} />
        </Suspense>
      );
    }

    if (currentTab.id === 'install' || currentTab.id === 'package-explorer') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Packages..." /></div>}>
          <ReplitPackagesPanel projectId={projectId} />
        </Suspense>
      );
    }

    if (currentTab.id === 'extension-store') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Extensions..." /></div>}>
          <ExtensionsMarketplace projectId={projectId} />
        </Suspense>
      );
    }

    if (currentTab.id === 'user-settings') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Settings..." /></div>}>
          <ReplitSettingsPanel projectId={projectId} />
        </Suspense>
      );
    }

    if (currentTab.id === 'version-control' || currentTab.id === 'fork-graph') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Git..." /></div>}>
          <ReplitGitPanel projectId={projectId} />
        </Suspense>
      );
    }

    if (currentTab.id === 'deployments') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Deployments..." /></div>}>
          <ReplitDeploymentPanel projectId={projectId} />
        </Suspense>
      );
    }

    if (currentTab.id === 'code-search') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Search..." /></div>}>
          <GlobalSearch
            isOpen={true}
            inline={true}
            onClose={() => {}}
            projectId={projectId}
            onFileSelect={(file) => handleFileSelect({ id: file.id, filename: file.filename })}
          />
        </Suspense>
      );
    }

    if (currentTab.id === 'docs') {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center h-9 px-3 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
            <span className="text-[13px] font-medium">Documentation</span>
          </div>
          <iframe
            src="https://docs.replit.com"
            className="flex-1 w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            data-testid="iframe-docs"
          />
        </div>
      );
    }

    if (currentTab.id === 'object-storage') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Object Storage..." /></div>}>
          <ObjectStoragePanel />
        </Suspense>
      );
    }

    if (currentTab.id === 'replit-key-value') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Key-Value Store..." /></div>}>
          <DatabasePanel projectId={projectId} />
        </Suspense>
      );
    }

    if (currentTab.id === 'vnc') {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center h-9 px-3 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
            <span className="text-[13px] font-medium">VNC Desktop</span>
          </div>
          <div className="flex-1 flex items-center justify-center bg-[var(--ide-surface)]">
            <div className="text-center space-y-3 max-w-xs">
              <Monitor className="w-12 h-12 text-[var(--ide-text-muted)]/30 mx-auto" />
              <div>
                <p className="text-[13px] font-medium text-[var(--ide-text)]" data-testid="text-vnc-title">Desktop Output</p>
                <p className="text-[11px] text-[var(--ide-text-muted)] mt-1">
                  VNC desktop output will appear here when your app renders a graphical window (e.g. Pygame, Tkinter, Qt).
                </p>
              </div>
              <p className="text-[10px] text-[var(--ide-text-muted)]/60">
                Start a process that creates a desktop window to connect.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (currentTab.id === 'resource-monitor') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Resource Monitor..." /></div>}>
          <ResourceMonitorPanel projectId={parseInt(projectId, 10) || 0} />
        </Suspense>
      );
    }

    if (currentTab.id === 'agent' || currentTab.id === 'assistant') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading AI Assistant..." /></div>}>
          <ReplitAgentPanelV3
            projectId={projectId}
            mode="desktop"
            agentToolsSettings={agentToolsSettings}
            onAgentToolsSettingsChange={setAgentToolsSettings}
            pendingMessage={bootstrapPendingMessage}
            onPendingMessageConsumed={() => setBootstrapPendingMessage(null)}
          />
        </Suspense>
      );
    }

    return <div className="flex items-center justify-center h-full text-muted-foreground">Select a file or tool</div>;
  };

  if (deviceType === 'mobile') {
    return (
      <div 
        className={cn(
          'flex flex-col h-screen w-screen overflow-hidden bg-background',
          'touch-manipulation',
          className
        )}
        data-testid="mobile-layout"
        data-ide-layout="unified"
        data-layout-type="mobile"
      >
        {/* E-Code Mobile IDE Header - glassmorphic design */}
        <Suspense fallback={null}>
          <MobileIDEHeader
            projectName={project?.name || 'Project'}
            isRunning={isRunning}
            onRun={handleRunStop}
            onStop={handleRunStop}
            onSearch={() => setMobileActiveTab('search' as MobileTab)}
            onSettings={() => handleAddOpenTab('settings')}
            onShare={() => {}}
            className="z-30"
          />
        </Suspense>

        {/* Main Content Area - maximized vertical space */}
        <div 
          className="flex-1 overflow-hidden"
          {...((mobileActiveTab === 'preview' || mobileActiveTab === 'agent') ? mobileSwipeHandlers : {})}
          data-testid="mobile-swipe-area"
          style={{ paddingBottom: mobileActiveTab === 'agent' ? '3.5rem' : '0' }}
        >
          <PageTransition
            key={mobileActiveTab}
            variant="fade"
            duration={0.2}
            className="h-full overflow-auto"
          >
            <OptimizedErrorBoundary level="component">
              {renderMobileContent()}
            </OptimizedErrorBoundary>
          </PageTransition>
        </div>

        {/* Replit-style Floating Input Bar - Only shown on Agent tab */}
        {mobileActiveTab === 'agent' && (
          <ReplitMobileInputBar
            placeholder={mobileAgentHandlers?.agentMode === 'build' ? "What would you like to build?" : undefined}
            onSubmit={(value) => {
              if (mobileAgentHandlers?.handleSubmit) {
                mobileAgentHandlers.handleSubmit(value);
              }
            }}
            isWorking={mobileAgentHandlers?.isWorking}
            agentMode={mobileAgentHandlers?.agentMode}
            onModeChange={(mode) => mobileAgentHandlers?.onModeChange?.(mode)}
            onSlashCommand={() => mobileAgentHandlers?.handleSlashCommand?.()}
            agentToolsSettings={mobileAgentHandlers?.agentToolsSettings}
            onAgentToolsSettingsChange={mobileAgentHandlers?.onAgentToolsSettingsChange}
            onAttach={() => mobileAgentHandlers?.onAttach?.()}
            onVoice={() => mobileAgentHandlers?.onVoice?.()}
            isRecording={mobileAgentHandlers?.isRecording}
            isUploadingFiles={mobileAgentHandlers?.isUploadingFiles}
            pendingAttachmentsCount={mobileAgentHandlers?.pendingAttachmentsCount}
          />
        )}

        {/* Premium Glassmorphic Bottom Navigation */}
        <ReplitBottomTabs
          activeTab={mobileActiveTab}
          onTabChange={(tab: string) => {
            if (tab === 'more') {
              setShowMobileMoreMenu(true);
            } else {
              setMobileActiveTab(tab as MobileTab);
            }
          }}
          badgeCounts={{
            git: gitChangesCount > 0 ? gitChangesCount : undefined,
            errors: errorsCount > 0 ? errorsCount : undefined,
          }}
          isConnected={isConnected}
        />

        {/* BottomSheet wrapper for More Menu */}
        <BottomSheet
          isOpen={showMobileMoreMenu}
          onClose={() => setShowMobileMoreMenu(false)}
          height="80vh"
        >
          <Suspense fallback={null}>
            <MobileMoreMenu
              projectId={projectId}
              isOpen={showMobileMoreMenu}
              onClose={() => setShowMobileMoreMenu(false)}
              onOpenGit={() => { setShowMobileMoreMenu(false); handleAddOpenTab('git'); }}
              onOpenPackages={() => { setShowMobileMoreMenu(false); handleAddOpenTab('packages'); }}
              onOpenSecrets={() => { setShowMobileMoreMenu(false); handleAddOpenTab('secrets'); }}
              onOpenDatabase={() => { setShowMobileMoreMenu(false); handleAddOpenTab('database'); }}
              onOpenSettings={() => { setShowMobileMoreMenu(false); handleAddOpenTab('settings'); }}
              onOpenDebug={() => { setShowMobileMoreMenu(false); handleAddOpenTab('debug'); }}
              onOpenCollaboration={() => { setShowMobileMoreMenu(false); handleAddOpenTab('collaboration'); }}
              onOpenWorkflows={() => { setShowMobileMoreMenu(false); handleAddOpenTab('workflows'); }}
              onOpenHistory={() => { setShowMobileMoreMenu(false); handleAddOpenTab('history'); }}
              onOpenCheckpoints={() => { setShowMobileMoreMenu(false); handleAddOpenTab('checkpoints'); }}
              onOpenExtensions={() => { setShowMobileMoreMenu(false); handleAddOpenTab('extensions'); }}
              onOpenSecurity={() => { setShowMobileMoreMenu(false); handleAddOpenTab('security'); }}
              onOpenDeploy={() => { setShowMobileMoreMenu(false); handleAddOpenTab('deploy'); }}
              onOpenWeb={() => { setShowMobileMoreMenu(false); handleAddOpenTab('preview'); }}
              onOpenActions={() => { setShowMobileMoreMenu(false); handleAddOpenTab('actions'); }}
              onOpenTools={() => { setShowMobileMoreMenu(false); handleAddOpenTab('tools'); }}
              onOpenCommandPalette={() => { setShowMobileMoreMenu(false); setShowCommandPalette(true); }}
              onOpenGlobalSearch={() => { setShowMobileMoreMenu(false); handleAddOpenTab('search'); }}
              onOpenQuickFileSearch={() => { setShowMobileMoreMenu(false); setShowQuickFileSearch(true); }}
              onOpenKeyboardShortcuts={() => { setShowMobileMoreMenu(false); setShowKeyboardShortcuts(true); }}
              problemsCount={errorsCount}
            />
          </Suspense>
        </BottomSheet>

        {/* MobileModal wrapper for Command Palette */}
        <MobileModal
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          title="Command Palette"
          variant="center"
        >
          <Suspense fallback={null}>
            <CommandPalette
              open={showCommandPalette}
              onOpenChange={setShowCommandPalette}
              files={files}
              onFileSelect={(file: { id: number; name: string } | number) => {
                setShowCommandPalette(false);
                if (typeof file === 'number') {
                  handleFileSelect({ id: String(file), filename: '' });
                } else {
                  handleFileSelect({ id: file.id, filename: file.filename });
                }
              }}
              onToolSelect={(tool) => {
                setShowCommandPalette(false);
                handleAddTool(tool);
              }}
            />
          </Suspense>
        </MobileModal>

        {/* Mobile Tools Sheet */}
        <ReplitToolsSheet
          open={showToolsSheet}
          onClose={() => setShowToolsSheet(false)}
          onSelectTool={(tool) => {
            handleAddTool(tool);
            handleAddOpenTab(tool);
            setShowToolsSheet(false);
          }}
        />

        {/* Mobile Tab Switcher */}
        <Suspense fallback={null}>
          <MobileTabSwitcher
            isOpen={showTabSwitcher}
            onClose={() => setShowTabSwitcher(false)}
            openTabs={openTabs}
            activeTabId={activeOpenTabId}
            onTabSelect={handleSelectOpenTab}
            onTabClose={handleCloseOpenTab}
            onNewTab={() => {
              setShowTabSwitcher(false);
              setShowToolsSheet(true);
            }}
            onQuickAccess={handleQuickAccess}
          />
        </Suspense>
      </div>
    );
  }

  if (deviceType === 'tablet') {
    return (
      <div
        className={cn(
          'flex h-screen w-screen overflow-hidden bg-background',
          'touch-manipulation select-none',
          className
        )}
        data-testid="tablet-layout"
        data-ide-layout="unified"
        data-layout-type="tablet"
        {...tabletPanHandlers}
      >
        <div
          className={cn(
            "tablet-sidebar bg-background border-r border-border w-[280px] flex-shrink-0",
            "transition-all duration-300 ease-out",
            tabletDrawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
          data-testid="tablet-drawer"
        >
          <div className="flex items-center justify-between h-14 px-4 border-b border-border bg-muted/30">
            <h2 className="text-[13px] font-semibold">Files</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTabletDrawerOpen(false)}
              className="h-10 w-10 touch-manipulation tablet-sidebar-close-btn"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
          <div className="h-[calc(100%-3.5rem)] overflow-hidden">
            <ReplitFileExplorer
              projectId={projectId}
              onFileSelect={(file) => {
                handleFileSelect(file);
                setTabletPanel('editor');
                setMobileActiveTab('code' as MobileTab);
              }}
              selectedFileId={selectedFileId}
              isBootstrapping={!!bootstrapToken}
            />
          </div>
        </div>

        <div
          className={cn(
            "tablet-sidebar-overlay fixed inset-0 z-30 bg-black/20 backdrop-blur-sm",
            "transition-opacity duration-300",
            tabletDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setTabletDrawerOpen(false)}
        />

        <div className="flex-1 flex flex-col">
          {/* Replit-style Header for Tablet - Integrated with File Drawer Toggle */}
          <header className="sticky top-0 z-30 flex items-center justify-between h-12 px-3 bg-white dark:bg-[#1C1C1C] border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTabletDrawerOpen(!tabletDrawerOpen)}
                className="h-9 w-9"
                data-testid="button-tablet-drawer-toggle"
              >
                {tabletDrawerOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white text-[13px] capitalize">
                {mobileActiveTab}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleAddOpenTab('search')}
                className="h-9 w-9"
                data-testid="button-quick-search"
              >
                <Code className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowToolsSheet(true)}
                className="h-9 w-9"
                data-testid="button-tablet-more"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div 
            className="flex-1 overflow-auto"
            style={{ paddingBottom: mobileActiveTab === 'agent' ? '3.5rem' : '3.5rem' }}
          >
            <OptimizedErrorBoundary level="component">
              {renderMobileContent()}
            </OptimizedErrorBoundary>
          </div>

          {/* Replit-style Floating Input Bar for Agent Tab */}
          {mobileActiveTab === 'agent' && (
            <ReplitMobileInputBar
              placeholder={mobileAgentHandlers?.agentMode === 'build' ? "What would you like to build?" : undefined}
              onSubmit={(value) => {
                if (mobileAgentHandlers?.handleSubmit) {
                  mobileAgentHandlers.handleSubmit(value);
                }
              }}
              isWorking={mobileAgentHandlers?.isWorking}
              agentMode={mobileAgentHandlers?.agentMode}
              onModeChange={(mode) => mobileAgentHandlers?.onModeChange?.(mode)}
              onSlashCommand={() => mobileAgentHandlers?.handleSlashCommand?.()}
              agentToolsSettings={mobileAgentHandlers?.agentToolsSettings}
              onAgentToolsSettingsChange={mobileAgentHandlers?.onAgentToolsSettingsChange}
              onAttach={() => mobileAgentHandlers?.onAttach?.()}
              onVoice={() => mobileAgentHandlers?.onVoice?.()}
              isRecording={mobileAgentHandlers?.isRecording}
              isUploadingFiles={mobileAgentHandlers?.isUploadingFiles}
              pendingAttachmentsCount={mobileAgentHandlers?.pendingAttachmentsCount}
            />
          )}

          {/* Premium Glassmorphic Bottom Navigation for Tablet */}
          <ReplitBottomTabs
            activeTab={mobileActiveTab}
            onTabChange={(tab: string) => {
              if (tab === 'more') {
                setShowMobileMoreMenu(true);
              } else {
                setMobileActiveTab(tab as MobileTab);
              }
            }}
            badgeCounts={{
              git: gitChangesCount > 0 ? gitChangesCount : undefined,
              errors: errorsCount > 0 ? errorsCount : undefined,
            }}
            isConnected={isConnected}
          />

        </div>

        {showCommandPalette && (
          <Suspense fallback={null}>
            <CommandPalette
              open={showCommandPalette}
              onOpenChange={setShowCommandPalette}
              files={files}
              onFileSelect={(file: { id: number; name: string } | number) => {
                setShowCommandPalette(false);
                if (typeof file === 'number') {
                  handleFileSelect({ id: String(file), filename: '' });
                } else {
                  handleFileSelect({ id: file.id, filename: file.filename });
                }
              }}
              onToolSelect={(tool) => {
                setShowCommandPalette(false);
                handleAddTool(tool);
              }}
            />
          </Suspense>
        )}

        {/* Tablet Tools Sheet */}
        <ReplitToolsSheet
          open={showToolsSheet}
          onClose={() => setShowToolsSheet(false)}
          onSelectTool={(tool) => {
            handleAddTool(tool);
            handleAddOpenTab(tool);
            setShowToolsSheet(false);
          }}
        />

        {/* Tablet Tab Switcher */}
        <Suspense fallback={null}>
          <MobileTabSwitcher
            isOpen={showTabSwitcher}
            onClose={() => setShowTabSwitcher(false)}
            openTabs={openTabs}
            activeTabId={activeOpenTabId}
            onTabSelect={handleSelectOpenTab}
            onTabClose={handleCloseOpenTab}
            onNewTab={() => {
              setShowTabSwitcher(false);
              setShowToolsSheet(true);
            }}
            onQuickAccess={handleQuickAccess}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className={cn("flex h-screen bg-[var(--ecode-background)] overflow-hidden", className)} data-testid="desktop-layout" data-ide-layout="unified" data-layout-type="desktop">
      <ReplitActivityBar
        activeItem={activeActivityItem}
        onItemClick={handleActivityItemClick}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        badgeCounts={{
          git: gitChangesCount > 0 ? gitChangesCount : undefined,
          debug: problemsCount.errors > 0 ? problemsCount.errors : undefined,
        }}
      />
      
      <div className="flex flex-col flex-1 min-w-0">
        <TopNavBar
          projectName={projectName}
          projectDescription={projectDescription}
          projectSlug={project?.slug || String(project?.id || projectId)}
          ownerUsername={user?.username || ''}
          projectId={projectId}
          isDeployed={false}
          onRun={handleRunStop}
          isRunning={isRunning}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onTabClose={handleTabClose}
          onTabReorder={handleTabReorder}
          onOpenToolsSheet={() => setShowToolsSheet(true)}
          availableTools={availableTools}
          onAddTool={handleAddTool}
          showFileExplorer={showFileExplorer}
          onToggleFileExplorer={() => setShowFileExplorer((prev: boolean) => !prev)}
          showCollaboration={tabs.some(t => t.id === 'collaboration')}
          onToggleCollaboration={() => handleAddTool('collaboration')}
          collaboratorCount={0}
          onOpenDeployLogs={() => setDeploymentTab('logs')}
          onOpenDeployAnalytics={() => setDeploymentTab('analytics')}
          showTabs={false}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
          onOpenGlobalSearch={() => { setIsSidebarCollapsed(false); setLeftPanelTab('agent'); }}
        />
        
        <ReplitTabBar
          tabs={tabs.map(tab => ({
            id: tab.id,
            label: tab.label,
            closable: tab.closable,
            pinned: tab.pinned,
            modified: tab.modified,
            path: tab.path,
          }))}
          activeTabId={activeTab}
          onTabClick={setActiveTab}
          onTabClose={handleTabClose}
          onTabReorder={handleTabReorder}
          onTabPin={handleTabPin}
          onTabDuplicate={handleTabDuplicate}
          onSplitRight={handleSplitRight}
          onAddTab={() => setShowToolsSheet(true)}
        />
        
        <ResizablePanelGroup direction="horizontal" className="flex-1" data-testid="desktop-panel-group">
          {!isSidebarCollapsed && (
            <ResizablePanel defaultSize={30} minSize={20} maxSize={40} data-testid="desktop-left-panel">
              <div className="h-full flex flex-col border-r border-[var(--ecode-border)]">
                <ReplitAgentPanelV3
                  key={`agent-${projectId}`}
                  projectId={projectId}
                  mode="desktop"
                  agentToolsSettings={agentToolsSettings}
                  onAgentToolsSettingsChange={setAgentToolsSettings}
                  isBootstrapping={!!bootstrapToken}
                  bootstrapToken={bootstrapToken}
                  onBootstrapFailure={onBootstrapFailure}
                  pendingMessage={bootstrapPendingMessage}
                  onPendingMessageConsumed={() => setBootstrapPendingMessage(null)}
                />
              </div>
            </ResizablePanel>
          )}
          
          {!isSidebarCollapsed && <ResizableHandle withHandle />}
          
          <ResizablePanel defaultSize={isSidebarCollapsed ? (showFileExplorer ? 82 : 100) : (showFileExplorer ? 52 : 70)} minSize={30} data-testid="desktop-main-panel">
            <div className="h-full flex flex-col">
              <div 
                className={cn(
                  "h-full w-full transition-opacity duration-100 ease-in-out",
                  tabContentVisible ? "opacity-100" : "opacity-0"
                )}
                data-testid="tab-content-wrapper"
              >
                <OptimizedErrorBoundary level="component">
                  {renderDesktopContent()}
                </OptimizedErrorBoundary>
              </div>
            </div>
          </ResizablePanel>
          
          {showFileExplorer && (
            <>
              <ResizableHandle withHandle />
              
              <ResizablePanel defaultSize={18} minSize={15} maxSize={30} data-testid="desktop-right-panel">
                <div className="h-full flex flex-col border-l border-[var(--ecode-border)]">
                  <div className="h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5">
                    <h3 className="font-medium text-xs text-[var(--ecode-text-muted)]">Files</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFileExplorer(false)}
                      className="h-6 w-6 p-0 text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <ReplitFileExplorer
                    projectId={projectId}
                    onFileSelect={handleFileSelect}
                    selectedFileId={selectedFileId}
                    isBootstrapping={!!bootstrapToken}
                  />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
        
        <StatusBar
          gitBranch={gitBranch}
          isRunning={isRunning}
          cursorPosition={cursorPosition}
          language={activeFileLanguage || "TypeScript"}
          encoding="UTF-8"
          onShowShortcuts={() => setShowKeyboardShortcuts(true)}
          onGoToLine={() => document.dispatchEvent(new CustomEvent('electron-go-to-line'))}
          isConnected={isConnected}
          lastSaved={lastSaved}
          problems={problemsCount}
          deploymentStatus={deploymentStatus}
          deploymentUrl={publishState?.url}
          onDeployClick={() => {
            handleAddTool('deployment');
            setDeploymentTab('logs');
          }}
        />
      </div>
      
      <QuickFileSearch
        open={showQuickFileSearch}
        onOpenChange={setShowQuickFileSearch}
        files={files.map(f => ({
          id: f.id.toString(),
          name: f.name,
          type: 'file' as const,
          path: f.path,
          content: f.content || ''
        }))}
        onFileSelect={(file) => {
          if (file.id) {
            setSelectedFileId(file.id);
            handleFileSelect({ id: file.id, filename: file.filename });
          }
          setShowQuickFileSearch(false);
        }}
      />
      
      {deviceType === 'mobile' ? (
        <MobileModal
          isOpen={showKeyboardShortcuts}
          onClose={() => setShowKeyboardShortcuts(false)}
          title="Keyboard Shortcuts"
          variant="fullscreen"
        >
          <KeyboardShortcutsOverlay
            open={showKeyboardShortcuts}
            onOpenChange={setShowKeyboardShortcuts}
            inline
          />
        </MobileModal>
      ) : (
        <KeyboardShortcutsOverlay
          open={showKeyboardShortcuts}
          onOpenChange={setShowKeyboardShortcuts}
        />
      )}
      
      <ReplitToolsSheet
        open={showToolsSheet}
        onClose={() => setShowToolsSheet(false)}
        onSelectTool={(tool) => {
          handleAddTool(tool);
          // Also add to open tabs for mobile navigation (harmless on desktop)
          handleAddOpenTab(tool);
          setShowToolsSheet(false);
        }}
      />
      
      {/* Mobile Tab Switcher Overlay */}
      <Suspense fallback={null}>
        <MobileTabSwitcher
          isOpen={showTabSwitcher}
          onClose={() => setShowTabSwitcher(false)}
          openTabs={openTabs}
          activeTabId={activeOpenTabId}
          onTabSelect={handleSelectOpenTab}
          onTabClose={handleCloseOpenTab}
          onNewTab={() => {
            setShowTabSwitcher(false);
            setShowToolsSheet(true);
          }}
          onQuickAccess={handleQuickAccess}
        />
      </Suspense>
      
      <Suspense fallback={null}>
        <CommandPalette
          open={showCommandPalette}
          onOpenChange={setShowCommandPalette}
          files={files}
          onFileSelect={(file: { id: number; name: string } | number) => {
            setShowCommandPalette(false);
            if (typeof file === 'number') {
              handleFileSelect({ id: String(file), filename: '' });
            } else {
              handleFileSelect({ id: file.id, filename: file.filename });
            }
          }}
          onToolSelect={(tool) => {
            setShowCommandPalette(false);
            handleAddTool(tool);
          }}
        />
      </Suspense>

      
      {/* ═══ Project Settings Dialog ═══ */}
      <Dialog open={projectSettingsOpen} onOpenChange={setProjectSettingsOpen}>
        <DialogContent className="bg-background border-border rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base">Project Settings</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">Configure your project</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateProjectMutation?.mutate({ name: projectNameInput, language: projectLangInput }); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Name</Label>
              <Input value={projectNameInput || ''} onChange={(e) => setProjectNameInput?.(e.target.value)} className="bg-background border-border h-9 text-sm text-foreground rounded-lg focus:border-primary" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Language</Label>
              <div className="flex flex-wrap gap-2">
                {['javascript', 'typescript', 'python', 'go', 'ruby', 'cpp', 'java', 'rust', 'bash', 'html'].map((lang) => (
                  <button key={lang} type="button" onClick={() => setProjectLangInput?.(lang)} className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${projectLangInput === lang ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground border border-border'}`}>
                    {lang}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium" disabled={updateProjectMutation?.isPending}>
              {updateProjectMutation?.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save Changes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ Publish Dialog ═══ */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="bg-background border-border rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base flex items-center gap-2">
              <Rocket className="w-4 h-4 text-green-500" /> Publish Project
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">Make your project publicly accessible via a shareable link</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-3 rounded-lg bg-background border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Visibility</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Control who can access this project</p>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${workspace.project?.visibility === 'private' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : workspace.project?.visibility === 'team' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>{workspace.project?.visibility === 'private' ? 'Private' : workspace.project?.visibility === 'team' ? 'Team' : 'Public'}</span>
              </div>
              <div className="flex gap-2">
                {['public', 'private', 'team'].map((v) => (
                  <button key={v} onClick={() => visibilityMutation?.mutate(v)} disabled={visibilityMutation?.isPending} className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-medium border transition-all ${workspace.project?.visibility === v ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted/30 text-muted-foreground border-border hover:text-foreground'}`}>
                    {v === 'public' ? 'Public' : v === 'private' ? 'Private' : 'Team'}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-[11px] text-foreground font-medium">Private Deployment</p>
                    <p className="text-[9px] text-muted-foreground">Require sign-in to access deployed app</p>
                  </div>
                </div>
                <Switch checked={deployIsPrivate} onCheckedChange={(v) => { setDeployIsPrivate?.(v); if (workspace.project?.isPublished) deploySettingsMutation?.mutate({ isPrivate: v }); }} />
              </div>
              {workspace.project?.visibility === 'private' && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-[11px] text-muted-foreground font-medium">Invited Guests</p>
                  <div className="flex gap-2">
                    <Input placeholder="Email address" value={deployInviteEmail || ''} onChange={(e) => setDeployInviteEmail?.(e.target.value)} className="bg-background border-border h-8 text-xs text-foreground rounded-lg flex-1" onKeyDown={(e) => { if (e.key === 'Enter' && deployInviteEmail?.trim()) { inviteGuestMutation?.mutate({ email: deployInviteEmail.trim(), role: 'viewer' }); setDeployInviteEmail?.(''); } }} />
                    <Button size="sm" className="h-8 px-3 text-[11px] bg-primary text-primary-foreground rounded-lg" onClick={() => { if (deployInviteEmail?.trim()) { inviteGuestMutation?.mutate({ email: deployInviteEmail.trim(), role: 'viewer' }); setDeployInviteEmail?.(''); } }}>Invite</Button>
                  </div>
                  {(guestsQuery?.data || []).length > 0 && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {(guestsQuery?.data || []).map((guest: any) => (
                        <div key={guest.id} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-muted/50 border border-border">
                          <div>
                            <span className="text-[11px] text-foreground">{guest.email}</span>
                            <span className="text-[9px] text-muted-foreground ml-2">{guest.acceptedAt ? 'Accepted' : 'Pending'}</span>
                          </div>
                          <button onClick={() => removeGuestMutation?.mutate(guest.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">{workspace.project?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">{workspace.project?.isPublished ? 'Published' : 'Draft'}</span>
                <Switch checked={workspace.project?.isPublished || false} onCheckedChange={() => workspace.publishMutation?.mutate()} disabled={workspace.publishMutation?.isPending} />
              </div>
            </div>

            {workspace.project?.isPublished && (
              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">Shareable URL</Label>
                <div className="flex gap-2">
                  <Input readOnly value={`${window.location.origin}/shared/${projectId}`} className="bg-background border-border h-9 text-xs text-foreground rounded-lg flex-1" />
                  <Button size="sm" variant="ghost" className="h-9 px-3 shrink-0" onClick={copyShareUrl}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-9 px-3 shrink-0" onClick={() => window.open(`/shared/${projectId}`, '_blank')}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <div className="border-t border-border pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Publish as Developer Framework</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Let others discover and fork this project</p>
                </div>
                <Switch checked={workspace.project?.isDevFramework || frameworkCheckbox} onCheckedChange={(checked) => { if (workspace.project?.isDevFramework && !checked) { frameworkUnpublishMutation?.mutate(); setFrameworkCheckbox?.(false); } else { setFrameworkCheckbox?.(checked); } }} disabled={frameworkPublishMutation?.isPending || frameworkUnpublishMutation?.isPending} />
              </div>
              {(frameworkCheckbox || workspace.project?.isDevFramework) && !workspace.project?.isDevFramework && (
                <div className="space-y-3 pl-1">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Description</Label>
                    <Input value={frameworkDesc || ''} onChange={(e) => setFrameworkDesc?.(e.target.value)} placeholder="A brief description of your framework..." className="bg-background border-border h-9 text-xs rounded-lg" />
                  </div>
                  <Button className="w-full h-9 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium" disabled={frameworkPublishMutation?.isPending} onClick={() => frameworkPublishMutation?.mutate({ description: frameworkDesc, category: frameworkCategory, coverUrl: frameworkCoverUrl })}>
                    {frameworkPublishMutation?.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Publish Framework'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Invite Collaborators Dialog ═══ */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="bg-background border-border rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base">Invite Collaborators</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">Share this link to invite others to collaborate in real-time</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {inviteLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : inviteLink ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Invite Link</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={inviteLink} className="bg-background border-border h-9 text-xs font-mono" />
                    <Button size="sm" variant="ghost" className="h-9 px-3 shrink-0" onClick={handleCopyInviteLink}>
                      {inviteLinkCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full h-8 text-xs font-medium" onClick={handleGenerateInviteLink}>
                  Generate New Link
                </Button>
              </>
            ) : (
              <Button className="w-full h-9 bg-primary text-primary-foreground font-medium" onClick={handleGenerateInviteLink}>
                Generate Invite Link
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Add Artifact Dialog ═══ */}
      <Dialog open={addArtifactDialogOpen} onOpenChange={setAddArtifactDialogOpen}>
        <DialogContent className="bg-background border-border rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base">Add Artifact</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">Add a new artifact to this project</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (newArtifactName?.trim()) createArtifactMutation?.mutate({ name: newArtifactName.trim(), type: newArtifactType }); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Name</Label>
              <Input value={newArtifactName || ''} onChange={(e) => setNewArtifactName?.(e.target.value)} placeholder="My Artifact" className="bg-background border-border h-9 text-sm" autoFocus required />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="ghost" className="flex-1 h-9 text-xs rounded-lg" onClick={() => setAddArtifactDialogOpen?.(false)}>Cancel</Button>
              <Button type="submit" className="flex-1 h-9 bg-primary text-primary-foreground text-xs font-medium" disabled={!newArtifactName?.trim() || createArtifactMutation?.isPending}>
                {createArtifactMutation?.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ Conversion Dialog ═══ */}
      {conversionDialogOpen && (
        <Suspense fallback={null}>
          <ConversionDialog open={conversionDialogOpen} onOpenChange={setConversionDialogOpen} projectId={projectId} frameId={conversionFrameId} frameName={conversionFrameName} initialTargetType={conversionTargetType} />
        </Suspense>
      )}

      {/* ═══ Animation Export ═══ */}
      {animationExportOpen && (
        <Suspense fallback={null}>
          <AnimationPreview projectId={projectId} previewUrl={livePreviewUrl} exportDialogOpen={animationExportOpen} onExportDialogClose={() => setAnimationExportOpen?.(false)} />
        </Suspense>
      )}

      {/* ═══ Split Editor ═══ */}
      {splitEditorFileId && (
        <Dialog open={!!splitEditorFileId} onOpenChange={(open) => { if (!open) setSplitEditorFileId?.(null); }}>
          <DialogContent className="bg-background border-border rounded-xl sm:max-w-4xl h-[80vh]">
            <DialogHeader>
              <DialogTitle className="text-foreground text-base">Split View</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <Suspense fallback={<ECodeLoading size="md" />}>
                <ReplitMonacoEditor projectId={projectId} fileId={splitEditorFileId} fileContents={fileContents} onCodeChange={handleCodeChange} onCursorChange={handleCursorChange} fontSize={userPrefs?.fontSize} tabSize={userPrefs?.tabSize} wordWrap={userPrefs?.wordWrap} minimap={userPrefs?.minimap} filename={filesRaw?.find((f: any) => String(f.id) === splitEditorFileId)?.filename} />
              </Suspense>
            </div>
          </DialogContent>
        </Dialog>
      )}


      {/* Autonomous Workspace Viewer - Shows bootstrap progress as dialog (only when inline mode is disabled) */}
      {/* When inline mode is enabled (default), progress appears in the agent chat instead */}
      {bootstrapToken && !autonomousBuildStore.inlineMode && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center" data-testid="workspace-viewer-loading">
            <div className="text-center space-y-4">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[13px] text-muted-foreground">Loading workspace viewer...</p>
            </div>
          </div>
        }>
          <AutonomousWorkspaceViewer
            bootstrapToken={bootstrapToken}
            projectId={projectId}
            onComplete={onWorkspaceComplete}
            onError={onWorkspaceError}
          />
        </Suspense>
      )}

      {enableShortcutHint && <ShortcutHint />}
      {enableShortcutTester && <ShortcutTester />}
    </div>
  );
}

export default UnifiedIDELayout;
