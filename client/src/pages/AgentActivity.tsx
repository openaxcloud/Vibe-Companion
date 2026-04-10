import { useState, Suspense } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, ArrowLeft, BarChart3, FileCode, 
  MessageSquare, Zap, Clock, Bot, TrendingUp,
  Wrench, Workflow
} from 'lucide-react';
import { 
  LazyAgentSessionsGrid, 
  LazyAgentActionsGrid, 
  LazyFileOperationsGrid, 
  LazyConversationHistoryGrid,
  GridFallback 
} from '@/components/lazy/LazyAgGrid';
import { ToolCatalog } from '@/components/agent/ToolCatalog';
import { WorkflowStatus } from '@/components/agent/WorkflowStatus';
import type { AgentSessionRow } from '@shared/types/agent-grid.types';
import { instrumentedLazy } from '@/utils/instrumented-lazy';

const AgentMetricsDashboard = instrumentedLazy(() => import('@/components/grids/AgentMetricsDashboard').then(m => ({ default: m.AgentMetricsDashboard })), 'AgentMetricsDashboard');

const DashboardSkeleton = () => (
  <div className="space-y-4 p-4">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
    </div>
    <Skeleton className="h-64" />
  </div>
);

export default function AgentActivity() {
  const [, navigate] = useLocation();
  const [selectedSession, setSelectedSession] = useState<AgentSessionRow | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleSessionSelect = (session: AgentSessionRow) => {
    setSelectedSession(session);
    setActiveTab('actions');
  };

  const handleBackToSessions = () => {
    setSelectedSession(null);
    setActiveTab('sessions');
  };

  return (
    <div className="min-h-screen bg-background pb-safe">
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 pt-safe">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="gap-2 min-h-[44px] px-3"
                data-testid="button-back-dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden xs:inline">Dashboard</span>
              </Button>
              <div className="hidden sm:block h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <h1 className="text-[15px] sm:text-xl font-semibold">Agent Activity</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedSession && (
                <>
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    Session: {selectedSession.id.slice(0, 8)}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBackToSessions}
                    className="gap-1 min-h-[44px]"
                    data-testid="button-back-sessions"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    All Sessions
                  </Button>
                </>
              )}
              <Badge variant="outline" className="gap-1 hidden md:flex">
                <Bot className="h-3 w-3" />
                AI Agent Dashboard
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full max-w-4xl grid-cols-7 mx-auto h-auto p-1">
            <TabsTrigger 
              value="dashboard" 
              className="gap-1 sm:gap-2 min-h-[44px] flex-col sm:flex-row py-2 px-1 sm:px-3" 
              data-testid="tab-dashboard"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="text-[10px] sm:text-[13px]">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger 
              value="tools" 
              className="gap-1 sm:gap-2 min-h-[44px] flex-col sm:flex-row py-2 px-1 sm:px-3" 
              data-testid="tab-tools"
            >
              <Wrench className="h-4 w-4" />
              <span className="text-[10px] sm:text-[13px]">Tools</span>
            </TabsTrigger>
            <TabsTrigger 
              value="workflows" 
              className="gap-1 sm:gap-2 min-h-[44px] flex-col sm:flex-row py-2 px-1 sm:px-3" 
              data-testid="tab-workflows"
            >
              <Workflow className="h-4 w-4" />
              <span className="text-[10px] sm:text-[13px]">Workflows</span>
            </TabsTrigger>
            <TabsTrigger 
              value="sessions" 
              className="gap-1 sm:gap-2 min-h-[44px] flex-col sm:flex-row py-2 px-1 sm:px-3" 
              data-testid="tab-sessions"
            >
              <Clock className="h-4 w-4" />
              <span className="text-[10px] sm:text-[13px]">Sessions</span>
            </TabsTrigger>
            <TabsTrigger 
              value="actions" 
              className="gap-1 sm:gap-2 min-h-[44px] flex-col sm:flex-row py-2 px-1 sm:px-3" 
              data-testid="tab-actions"
            >
              <Zap className="h-4 w-4" />
              <span className="text-[10px] sm:text-[13px]">Actions</span>
            </TabsTrigger>
            <TabsTrigger 
              value="files" 
              className="gap-1 sm:gap-2 min-h-[44px] flex-col sm:flex-row py-2 px-1 sm:px-3" 
              data-testid="tab-files"
            >
              <FileCode className="h-4 w-4" />
              <span className="text-[10px] sm:text-[13px]">Files</span>
            </TabsTrigger>
            <TabsTrigger 
              value="messages" 
              className="gap-1 sm:gap-2 min-h-[44px] flex-col sm:flex-row py-2 px-1 sm:px-3" 
              data-testid="tab-messages"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="text-[10px] sm:text-[13px]">Messages</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Agent Metrics Overview
                </CardTitle>
                <CardDescription>
                  Comprehensive analytics and performance metrics for your AI agent sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<DashboardSkeleton />}>
                  <AgentMetricsDashboard />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tools" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Agent Tool Catalog
                </CardTitle>
                <CardDescription>
                  Browse all available tools the AI agent can use to complete tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ToolCatalog />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflows" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="h-5 w-5" />
                  Workflow Status
                </CardTitle>
                <CardDescription>
                  Monitor active and recent workflows with real-time progress updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WorkflowStatus />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Agent Sessions
                </CardTitle>
                <CardDescription>
                  View and analyze all AI agent sessions with filtering, sorting, and export capabilities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<GridFallback />}>
                  <LazyAgentSessionsGrid onSessionSelect={handleSessionSelect} />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Agent Actions
                  {selectedSession && (
                    <Badge variant="secondary" className="ml-2">
                      Filtered by session
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Detailed log of all autonomous actions performed by the AI agent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<GridFallback />}>
                  <LazyAgentActionsGrid sessionId={selectedSession?.id} />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode className="h-5 w-5" />
                  File Operations
                  {selectedSession && (
                    <Badge variant="secondary" className="ml-2">
                      Filtered by session
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Track all file system operations including creates, updates, and deletes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<GridFallback />}>
                  <LazyFileOperationsGrid sessionId={selectedSession?.id} />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Conversation History
                  {selectedSession && (
                    <Badge variant="secondary" className="ml-2">
                      Filtered by session
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Browse and search through all AI conversation messages with extended thinking details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<GridFallback />}>
                  <LazyConversationHistoryGrid sessionId={selectedSession?.id} />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
