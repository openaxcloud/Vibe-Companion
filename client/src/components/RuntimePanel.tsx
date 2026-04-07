/**
 * RuntimePanel component
 * Provides UI for interacting with project runtimes, viewing logs, etc.
 */

import React, { useState } from 'react';
import { useRuntime } from '@/hooks/useRuntime';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Loader2, Play, Square, Terminal, RefreshCw, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface RuntimePanelProps {
  projectId: number;
}

export function RuntimePanel({ projectId }: RuntimePanelProps) {
  const { toast } = useToast();
  const [command, setCommand] = useState('');
  const [commandOutput, setCommandOutput] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('logs');
  
  const {
    status,
    isRunning,
    url,
    logs,
    startRuntime,
    stopRuntime,
    executeCommand,
  } = useRuntime(projectId);

  const handleStartRuntime = async () => {
    try {
      const result = await startRuntime.mutateAsync();
      if (result.success) {
        toast({
          title: 'Runtime started',
          description: 'Project runtime started successfully',
        });
      } else {
        toast({
          title: 'Failed to start runtime',
          description: result.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Failed to start runtime',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleStopRuntime = async () => {
    try {
      const result = await stopRuntime.mutateAsync();
      if (result.success) {
        toast({
          title: 'Runtime stopped',
          description: 'Project runtime stopped successfully',
        });
      } else {
        toast({
          title: 'Failed to stop runtime',
          description: result.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Failed to stop runtime',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleExecuteCommand = async () => {
    if (!command.trim()) return;
    
    try {
      const result = await executeCommand.mutateAsync(command);
      setCommandOutput(result.output);
      setCommand('');
    } catch (error) {
      toast({
        title: 'Failed to execute command',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const statusBadgeColor = () => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'starting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      case 'stopped': return 'bg-slate-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-md">
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Runtime Environment</h3>
          <Badge className={statusBadgeColor()}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {isRunning ? (
            <>
              {url && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-1"
                  onClick={() => window.open(url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open App
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-1 text-red-500"
                onClick={handleStopRuntime}
                disabled={stopRuntime.isPending}
              >
                {stopRuntime.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                Stop
              </Button>
            </>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1 text-green-500"
              onClick={handleStartRuntime}
              disabled={startRuntime.isPending || status === 'starting'}
            >
              {startRuntime.isPending || status === 'starting' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {status === 'starting' ? 'Starting...' : 'Start'}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="px-2 pt-2 bg-transparent">
          <TabsTrigger value="logs" className="data-[state=active]:bg-muted">
            Logs
          </TabsTrigger>
          <TabsTrigger value="terminal" className="data-[state=active]:bg-muted">
            Terminal
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="logs" className="flex-1 p-0 m-0">
          <ScrollArea className="h-[calc(100%-2rem)] p-2">
            <div className="font-mono text-xs whitespace-pre-wrap">
              {logs.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  No logs available
                </div>
              ) : (
                logs.map((log, i) => (
                  <div 
                    key={i} 
                    className={`py-1 ${log.includes('ERROR') ? 'text-red-500' : ''}`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="terminal" className="flex-1 p-0 m-0 flex flex-col">
          <ScrollArea className="flex-1 p-2">
            <div className="font-mono text-xs whitespace-pre-wrap">
              {commandOutput === null ? (
                <div className="text-center text-muted-foreground py-4">
                  Execute a command to see output
                </div>
              ) : (
                <div className={`py-1 ${commandOutput.includes('ERROR') ? 'text-red-500' : ''}`}>
                  {commandOutput}
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="p-2 border-t flex items-center gap-2">
            <form className="flex-1 flex items-center gap-2" onSubmit={(e) => {
              e.preventDefault();
              handleExecuteCommand();
            }}>
              <Input
                placeholder="Enter command to execute..."
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                disabled={!isRunning || executeCommand.isPending}
                className="font-mono text-xs"
              />
              <Button 
                type="submit"
                size="sm"
                disabled={!isRunning || !command.trim() || executeCommand.isPending}
              >
                {executeCommand.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Terminal className="h-4 w-4" />
                )}
                <span className="ml-1">Run</span>
              </Button>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}