/**
 * Pending Approvals Panel - Fortune 500 Security UI
 * 
 * Replit-Style approval interface with:
 * - Clear approve/reject actions
 * - Security badges and indicators
 * - Real-time updates
 * - Bulk operations support
 */

import { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, Clock, Shield, AlertTriangle, 
  FileCode, Folder, Package, Code, ChevronRight, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { apiRequest } from '@/lib/queryClient';

interface PendingAction {
  id: string;
  action: {
    type: string;
    path?: string;
    content?: string;
    package?: string;
  };
  createdAt: string;
  expiresAt: string;
}

interface PendingApprovalsPanelProps {
  projectId: string | number;
  onActionApproved?: () => void;
  onActionRejected?: () => void;
}

export function PendingApprovalsPanel({ 
  projectId, 
  onActionApproved,
  onActionRejected 
}: PendingApprovalsPanelProps) {
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [rejectDialogAction, setRejectDialogAction] = useState<PendingAction | null>(null);
  const { toast } = useToast();

  // Fetch pending actions
  const fetchPendingActions = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/ai/pending`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setPendingActions(data.actions || []);
      }
    } catch (error) {
      console.error('Failed to fetch pending actions:', error);
    }
  };

  // Auto-refresh - RATE LIMIT FIX: Reduced from 5s to 30s, pause when hidden
  useEffect(() => {
    fetchPendingActions();
    
    // Only poll when page is visible to prevent rate limit exceeded
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPendingActions();
      }
    };
    
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchPendingActions();
      }
    }, 30000); // 30s instead of 5s
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [projectId]);

  // Approve action
  const handleApprove = async (actionId: string) => {
    setActionInProgress(actionId);
    try {
      const response = await apiRequest('POST', `/api/projects/${projectId}/ai/approve/${actionId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to approve action');
      }

      toast({
        title: "✅ Action Approved",
        description: "The AI action has been executed successfully.",
      });

      // Remove from list
      setPendingActions(prev => prev.filter(a => a.id !== actionId));
      onActionApproved?.();
    } catch (error: any) {
      toast({
        title: "❌ Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionInProgress(null);
    }
  };

  // Reject action
  const handleReject = async (actionId: string, reason?: string) => {
    setActionInProgress(actionId);
    try {
      const response = await apiRequest('POST', `/api/projects/${projectId}/ai/reject/${actionId}`, { reason: reason || 'User rejected' });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reject action');
      }

      toast({
        title: "Action Rejected",
        description: "The AI action has been rejected.",
      });

      // Remove from list
      setPendingActions(prev => prev.filter(a => a.id !== actionId));
      onActionRejected?.();
    } catch (error: any) {
      toast({
        title: "❌ Rejection Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionInProgress(null);
      setRejectDialogAction(null);
    }
  };

  // Get action icon
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'create_file':
        return <FileCode className="h-4 w-4" />;
      case 'edit_file':
        return <Code className="h-4 w-4" />;
      case 'create_folder':
        return <Folder className="h-4 w-4" />;
      case 'install_package':
        return <Package className="h-4 w-4" />;
      default:
        return <Code className="h-4 w-4" />;
    }
  };

  // Get action label
  const getActionLabel = (action: PendingAction['action']) => {
    switch (action.type) {
      case 'create_file':
        return `Create ${action.path}`;
      case 'edit_file':
        return `Edit ${action.path}`;
      case 'create_folder':
        return `Create folder ${action.path}`;
      case 'install_package':
        return `Install ${action.package}`;
      default:
        return action.type;
    }
  };

  // Calculate time remaining
  const getTimeRemaining = (expiresAt: string) => {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return remaining > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : 'Expired';
  };

  if (pendingActions.length === 0) {
    return (
      <Card className="border-dashed" data-testid="pending-approvals-empty">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            <CardTitle className="text-base">Pending Approvals</CardTitle>
          </div>
          <CardDescription className="text-[11px]">
            No actions waiting for approval
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="pending-approvals-panel">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base">Pending Approvals</CardTitle>
            </div>
            <Badge variant="secondary" className="text-[11px]" data-testid="pending-count">
              {pendingActions.length}
            </Badge>
          </div>
          <CardDescription className="text-[11px]">
            AI actions require your approval for security
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[300px]">
            <div className="space-y-2 p-4 pt-0">
              {pendingActions.map((item) => (
                <Card 
                  key={item.id} 
                  className="border-l-4 border-l-amber-500"
                  data-testid={`pending-action-${item.id}`}
                >
                  <CardContent className="p-3">
                    {/* Action Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                          {getActionIcon(item.action.type)}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-[13px]">
                            {getActionLabel(item.action)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {item.action.type.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {getTimeRemaining(item.expiresAt)}
                      </div>
                    </div>

                    {/* Security Badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-[11px]">
                        <AlertTriangle className="h-3 w-3 mr-1 text-amber-600" />
                        Requires Approval
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">
                        <Shield className="h-3 w-3 mr-1 text-blue-600" />
                        Security Check
                      </Badge>
                    </div>

                    {/* Preview (if file content) */}
                    {item.action.content && (
                      <div className="mb-3 p-2 rounded bg-muted text-[11px] font-mono overflow-hidden">
                        <div className="line-clamp-2">
                          {item.action.content}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(item.id)}
                        disabled={actionInProgress !== null}
                        data-testid={`approve-button-${item.id}`}
                      >
                        {actionInProgress === item.id ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Approving...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => setRejectDialogAction(item)}
                        disabled={actionInProgress !== null}
                        data-testid={`reject-button-${item.id}`}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={rejectDialogAction !== null} onOpenChange={() => setRejectDialogAction(null)}>
        <AlertDialogContent data-testid="reject-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject AI Action?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this action? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="reject-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectDialogAction && handleReject(rejectDialogAction.id)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="reject-confirm"
            >
              Reject Action
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
