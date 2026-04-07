import { X, ChevronUp, ChevronDown, MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface QueuedMessage {
  id: string;
  content: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: string;
}

interface MessageQueueProps {
  sessionId: string;
  messages: QueuedMessage[];
  isLoading?: boolean;
  className?: string;
}

export function MessageQueue({ sessionId, messages, isLoading, className }: MessageQueueProps) {
  const queryClient = useQueryClient();
  const pendingMessages = messages.filter(m => m.status === 'pending');
  
  const cancelMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest('DELETE', `/api/autonomy/sessions/${sessionId}/messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/autonomy/sessions', sessionId, 'messages'] });
    }
  });
  
  const priorityMutation = useMutation({
    mutationFn: async ({ messageId, priority }: { messageId: string; priority: number }) => {
      await apiRequest('PATCH', `/api/autonomy/sessions/${sessionId}/messages/${messageId}/priority`, { priority });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/autonomy/sessions', sessionId, 'messages'] });
    }
  });

  if (pendingMessages.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className={cn("bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3", className)}>
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-[13px] font-medium text-amber-900 dark:text-amber-100">
          Message Queue
        </span>
        <Badge variant="outline" className="text-[11px] bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700">
          {pendingMessages.length} pending
        </Badge>
      </div>
      
      <div className="space-y-2" data-testid="container-message-queue">
        {pendingMessages.map((message, index) => (
          <div 
            key={message.id}
            className="flex items-start gap-2 p-2 bg-white dark:bg-gray-900 rounded border border-amber-200 dark:border-amber-800"
            data-testid={`queued-message-${message.id}`}
          >
            <div className="flex flex-col gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                disabled={index === 0 || priorityMutation.isPending}
                onClick={() => priorityMutation.mutate({ 
                  messageId: message.id, 
                  priority: message.priority + 1 
                })}
                data-testid={`button-priority-up-${message.id}`}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                disabled={index === pendingMessages.length - 1 || priorityMutation.isPending}
                onClick={() => priorityMutation.mutate({ 
                  messageId: message.id, 
                  priority: message.priority - 1 
                })}
                data-testid={`button-priority-down-${message.id}`}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-gray-900 dark:text-gray-100 line-clamp-2">
                {message.content}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {new Date(message.createdAt).toLocaleTimeString()}
              </p>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-red-500"
              onClick={() => cancelMutation.mutate(message.id)}
              disabled={cancelMutation.isPending}
              data-testid={`button-cancel-message-${message.id}`}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
