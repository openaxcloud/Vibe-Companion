import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Terminal, 
  X, 
  Maximize2, 
  Minimize2, 
  Copy, 
  Trash2,
  Download,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ExecutionConsoleProps {
  projectId: number;
  executionId?: string;
  isRunning: boolean;
  className?: string;
}

interface ExecutionOutput {
  type: 'stdout' | 'stderr' | 'system';
  text: string;
  timestamp: number;
}

interface ExecutionResult {
  executionId: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  status: 'running' | 'completed' | 'error';
  error?: string;
}

export function ExecutionConsole({ 
  projectId, 
  executionId,
  isRunning,
  className 
}: ExecutionConsoleProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [output, setOutput] = useState<ExecutionOutput[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Poll for execution results
  const { data: executionResult } = useQuery<ExecutionResult>({
    queryKey: [`/api/executions/${executionId}`],
    enabled: !!executionId && isRunning,
    refetchInterval: isRunning ? 1000 : false, // Poll every second while running
  });

  useEffect(() => {
    if (executionResult) {
      const newOutputs: ExecutionOutput[] = [];
      
      if (executionResult.stdout) {
        newOutputs.push({
          type: 'stdout',
          text: executionResult.stdout,
          timestamp: Date.now()
        });
      }
      
      if (executionResult.stderr) {
        newOutputs.push({
          type: 'stderr',
          text: executionResult.stderr,
          timestamp: Date.now()
        });
      }
      
      if (executionResult.exitCode !== undefined && !isRunning) {
        newOutputs.push({
          type: 'system',
          text: `\nProcess exited with code ${executionResult.exitCode}`,
          timestamp: Date.now()
        });
      }
      
      setOutput(prev => [...prev, ...newOutputs]);
    }
  }, [executionResult, isRunning]);

  useEffect(() => {
    // Auto-scroll to bottom when new output arrives
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  const handleCopy = () => {
    const text = output
      .map(o => o.text)
      .join('\n');
    navigator.clipboard.writeText(text);
  };

  const handleClear = () => {
    setOutput([]);
  };

  const handleDownload = () => {
    const text = output
      .map(o => `[${new Date(o.timestamp).toISOString()}] ${o.text}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-${executionId || 'output'}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'f') {
        e.preventDefault();
        setShowSearch(!showSearch);
      } else if (e.key === 'l') {
        e.preventDefault();
        handleClear();
      }
    }
  };

  const filteredOutput = searchTerm
    ? output.filter(o => o.text.toLowerCase().includes(searchTerm.toLowerCase()))
    : output;

  return (
    <div 
      className={cn(
        'flex flex-col bg-gray-900 border border-gray-700 rounded-lg overflow-hidden',
        isFullscreen ? 'fixed inset-4 z-50' : 'h-full',
        className
      )}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Console</span>
          {isRunning && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Running
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-white"
            onClick={() => setShowSearch(!showSearch)}
            title="Search (Ctrl+F)"
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-white"
            onClick={handleCopy}
            title="Copy output"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-white"
            onClick={handleDownload}
            title="Download logs"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-white"
            onClick={handleClear}
            title="Clear console (Ctrl+L)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-white"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
          
          {isFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-white"
              onClick={() => setIsFullscreen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search output..."
            className="w-full px-3 py-1 text-sm bg-gray-900 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowSearch(false);
                setSearchTerm('');
              }
            }}
          />
        </div>
      )}

      {/* Console Output */}
      <div 
        ref={consoleRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm"
      >
        {filteredOutput.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            {isRunning ? 'Waiting for output...' : 'No output yet. Click Run to execute your code.'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredOutput.map((item, index) => (
              <div
                key={index}
                className={cn(
                  'whitespace-pre-wrap break-words',
                  item.type === 'stdout' && 'text-gray-300',
                  item.type === 'stderr' && 'text-red-400',
                  item.type === 'system' && 'text-blue-400'
                )}
              >
                {item.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}