/**
 * Agent History Modal Component
 * Full-featured modal for viewing agent session history
 * Phase 2 - Agent Activity Dashboard
 */

import { useState, useCallback, Suspense } from 'react';
import { instrumentedLazy } from '@/utils/instrumented-lazy';
import { 
  X, ChevronLeft, Activity, Table2, BarChart3, 
  FileCode, MessageSquare, Maximize2, Minimize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { 
  LazyAgentSessionsGrid, 
  LazyAgentActionsGrid, 
  LazyFileOperationsGrid, 
  LazyConversationHistoryGrid,
  GridFallback 
} from '@/components/lazy/LazyAgGrid';
import type { AgentSessionRow } from '@shared/types/agent-grid.types';

const AgentMetricsDashboard = instrumentedLazy(() => import('./AgentMetricsDashboard').then(m => ({ default: m.AgentMetricsDashboard })), 'AgentMetricsDashboard');

interface AgentHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  initialSessionId?: string;
}

export function AgentHistoryModal({ 
  open, 
  onOpenChange, 
  projectId,
  initialSessionId 
}: AgentHistoryModalProps) {
  const [selectedSession, setSelectedSession] = useState<AgentSessionRow | null>(null);
  const [activeTab, setActiveTab] = useState('sessions');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleSessionSelect = useCallback((session: AgentSessionRow) => {
    setSelectedSession(session);
    setActiveTab('actions');
  }, []);

  const handleBackToSessions = useCallback(() => {
    setSelectedSession(null);
    setActiveTab('sessions');
  }, []);

  const handleClose = useCallback(() => {
    setSelectedSession(null);
    setActiveTab('sessions');
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "gap-0 p-0 overflow-hidden",
          isFullscreen 
            ? "max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] rounded-none" 
            : "max-w-[95vw] w-[1400px] h-[85vh] max-h-[900px]"
        )}
        data-testid="agent-history-modal"
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            {selectedSession && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToSessions}
                className="h-8 px-2"
                data-testid="button-back-sessions"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Activity className="h-5 w-5 text-muted-foreground" />
            <DialogTitle className="text-[15px]">
              {selectedSession ? (
                <div className="flex items-center gap-2">
                  <span>Session Details</span>
                  <Badge variant="secondary" className="text-[11px] font-mono">
                    {selectedSession.id.slice(0, 8)}
                  </Badge>
                </div>
              ) : (
                'Agent Activity History'
              )}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8 p-0"
              data-testid="button-toggle-fullscreen"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
              data-testid="button-close-modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {selectedSession ? (
            /* Session Detail View */
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="border-b px-6">
                <TabsList className="h-10 bg-transparent gap-2">
                  <TabsTrigger 
                    value="actions" 
                    className="data-[state=active]:bg-muted"
                    data-testid="tab-actions"
                  >
                    <Activity className="h-4 w-4 mr-1.5" />
                    Actions
                  </TabsTrigger>
                  <TabsTrigger 
                    value="files" 
                    className="data-[state=active]:bg-muted"
                    data-testid="tab-files"
                  >
                    <FileCode className="h-4 w-4 mr-1.5" />
                    Files
                  </TabsTrigger>
                  <TabsTrigger 
                    value="messages" 
                    className="data-[state=active]:bg-muted"
                    data-testid="tab-messages"
                  >
                    <MessageSquare className="h-4 w-4 mr-1.5" />
                    Messages
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-6">
                  <TabsContent value="actions" className="mt-0">
                    <Suspense fallback={<GridFallback height={isFullscreen ? 'calc(100vh - 200px)' : 500} />}>
                      <LazyAgentActionsGrid 
                        sessionId={selectedSession.id}
                        height={isFullscreen ? 'calc(100vh - 200px)' : 500}
                      />
                    </Suspense>
                  </TabsContent>
                  
                  <TabsContent value="files" className="mt-0">
                    <Suspense fallback={<GridFallback height={isFullscreen ? 'calc(100vh - 200px)' : 500} />}>
                      <LazyFileOperationsGrid 
                        sessionId={selectedSession.id}
                        height={isFullscreen ? 'calc(100vh - 200px)' : 500}
                      />
                    </Suspense>
                  </TabsContent>
                  
                  <TabsContent value="messages" className="mt-0">
                    <Suspense fallback={<GridFallback height={isFullscreen ? 'calc(100vh - 200px)' : 500} />}>
                      <LazyConversationHistoryGrid 
                        sessionId={selectedSession.id}
                        height={isFullscreen ? 'calc(100vh - 200px)' : 500}
                      />
                    </Suspense>
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          ) : (
            /* Sessions Overview */
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="border-b px-6">
                <TabsList className="h-10 bg-transparent gap-2">
                  <TabsTrigger 
                    value="sessions" 
                    className="data-[state=active]:bg-muted"
                    data-testid="tab-sessions"
                  >
                    <Table2 className="h-4 w-4 mr-1.5" />
                    Sessions
                  </TabsTrigger>
                  <TabsTrigger 
                    value="metrics" 
                    className="data-[state=active]:bg-muted"
                    data-testid="tab-metrics"
                  >
                    <BarChart3 className="h-4 w-4 mr-1.5" />
                    Metrics
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-6">
                  <TabsContent value="sessions" className="mt-0">
                    <Suspense fallback={<GridFallback height={isFullscreen ? 'calc(100vh - 200px)' : 550} />}>
                      <LazyAgentSessionsGrid 
                        projectId={projectId}
                        onSessionSelect={handleSessionSelect}
                        height={isFullscreen ? 'calc(100vh - 200px)' : 550}
                      />
                    </Suspense>
                  </TabsContent>
                  
                  <TabsContent value="metrics" className="mt-0">
                    <Suspense fallback={<Skeleton className="h-96" />}>
                      <AgentMetricsDashboard projectId={projectId} />
                    </Suspense>
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AgentHistoryModal;
