import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, Clock, FileCode, FolderPlus, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface AgentAction {
  id: string;
  type: 'file_create' | 'file_edit' | 'package_install' | 'command_run';
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  metadata?: Record<string, any>;
}

interface AgentActionsPanelProps {
  projectId: string;
}

export function AgentActionsPanel({ projectId }: AgentActionsPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Load pending actions
  const { data: actions = [], isLoading } = useQuery<AgentAction[]>({
    queryKey: [`/api/agent/actions/${projectId}`],
    enabled: !!projectId,
    refetchInterval: 30000, // RATE LIMIT FIX: Increased from 5s to 30s
    refetchIntervalInBackground: false,
  });
  
  // Approve action
  const approveMutation = useMutation({
    mutationFn: async (actionId: string) => {
      await apiRequest('POST', `/api/agent/actions/${actionId}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/agent/actions/${projectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({
        title: 'Action approved',
        description: 'The AI action has been executed.'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve action',
        variant: 'destructive'
      });
    }
  });
  
  // Reject action
  const rejectMutation = useMutation({
    mutationFn: async (actionId: string) => {
      await apiRequest('POST', `/api/agent/actions/${actionId}/reject`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/agent/actions/${projectId}`] });
      toast({
        title: 'Action rejected',
        description: 'The AI action has been cancelled.'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject action',
        variant: 'destructive'
      });
    }
  });
  
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'file_create':
        return <FileCode className="h-4 w-4" />;
      case 'file_edit':
        return <FileCode className="h-4 w-4" />;
      case 'package_install':
        return <Package className="h-4 w-4" />;
      case 'command_run':
        return <FolderPlus className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };
  
  const pendingActions = actions.filter(a => a.status === 'pending');
  const completedActions = actions.filter(a => a.status !== 'pending');
  
  return (
    <div className="h-full flex flex-col bg-[var(--ecode-surface)]">
      <div className="h-9 border-b border-[var(--ecode-border)] flex items-center px-2.5 bg-[var(--ecode-surface)]">
        <h3 className="text-xs font-medium text-[var(--ecode-text-muted)]">Agent Actions</h3>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Pending Actions */}
          {pendingActions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[13px] font-medium text-muted-foreground">Pending Approval</h4>
              {pendingActions.map((action) => (
                <Card key={action.id} data-testid={`action-${action.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getActionIcon(action.type)}
                        <CardTitle className="text-[13px]">{action.type.replace('_', ' ')}</CardTitle>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    </div>
                    <CardDescription className="text-[11px]">
                      {action.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectMutation.mutate(action.id)}
                        disabled={rejectMutation.isPending}
                        data-testid={`button-reject-${action.id}`}
                        className="flex-1 gap-1"
                      >
                        <X className="h-3 w-3" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate(action.id)}
                        disabled={approveMutation.isPending}
                        data-testid={`button-approve-${action.id}`}
                        className="flex-1 gap-1"
                      >
                        <Check className="h-3 w-3" />
                        Approve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          {/* Completed Actions */}
          {completedActions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[13px] font-medium text-muted-foreground">History</h4>
              {completedActions.slice(0, 10).map((action) => (
                <Card key={action.id} className="bg-surface-tertiary-solid">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getActionIcon(action.type)}
                        <CardTitle className="text-[13px]">{action.type.replace('_', ' ')}</CardTitle>
                      </div>
                      <Badge
                        variant={action.status === 'approved' ? 'default' : 'destructive'}
                        className="shrink-0 text-[11px]"
                      >
                        {action.status === 'approved' ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                        {action.status}
                      </Badge>
                    </div>
                    <CardDescription className="text-[11px]">
                      {action.description}
                    </CardDescription>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}
                    </p>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
          
          {/* Empty State */}
          {actions.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-[13px]">No actions yet</p>
              <p className="text-[11px] mt-1">AI actions will appear here for approval</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
