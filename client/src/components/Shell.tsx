import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Terminal as TerminalIcon, Maximize2, Minimize2, Copy, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShellProps {
  projectId: number;
  isRunning?: boolean;
}

export function Shell({ projectId, isRunning = false }: ShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!shellRef.current || !isRunning) return;

    // Initialize shell with welcome message
    const welcomeMessage = `
Welcome to Replit Shell
Type 'help' for available commands
Project: ${projectId}
─────────────────────────────────
`;
    
    if (shellRef.current) {
      shellRef.current.innerHTML = `<pre class="text-green-400 font-mono text-sm">${welcomeMessage}</pre>`;
    }
  }, [projectId, isRunning]);

  const executeCommand = (command: string) => {
    if (!command.trim()) return;

    // Add command to history
    setHistory(prev => [...prev, command]);
    
    // Simple command handling for demo
    const output = handleCommand(command);
    
    if (shellRef.current) {
      const commandLine = `<div class="font-mono text-sm">
        <span class="text-green-400">$</span> <span class="text-white">${command}</span>
      </div>`;
      const outputLine = output ? `<div class="font-mono text-sm text-gray-300 pl-4">${output}</div>` : '';
      
      shellRef.current.innerHTML += commandLine + outputLine;
      shellRef.current.scrollTop = shellRef.current.scrollHeight;
    }
    
    setCurrentCommand('');
  };

  const handleCommand = (command: string): string => {
    const cmd = command.toLowerCase().trim();
    
    switch (cmd) {
      case 'help':
        return `Available commands:
  help     - Show this help message
  clear    - Clear the shell
  ls       - List files
  pwd      - Print working directory
  echo     - Echo a message
  date     - Show current date/time`;
      
      case 'clear':
        if (shellRef.current) {
          shellRef.current.innerHTML = '';
        }
        return '';
      
      case 'ls':
        return 'index.js  package.json  README.md  src/';
      
      case 'pwd':
        return `/home/runner/project-${projectId}`;
      
      case 'date':
        return new Date().toString();
      
      default:
        if (cmd.startsWith('echo ')) {
          return cmd.substring(5);
        }
        return `Command not found: ${command}`;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand(currentCommand);
    } else if (e.key === 'ArrowUp' && history.length > 0) {
      setCurrentCommand(history[history.length - 1]);
    }
  };

  const handleCopy = () => {
    if (shellRef.current) {
      const text = shellRef.current.innerText;
      navigator.clipboard.writeText(text);
      toast({
        title: 'Copied to clipboard',
        description: 'Shell output has been copied.',
      });
    }
  };

  const handleClear = () => {
    if (shellRef.current) {
      shellRef.current.innerHTML = '';
    }
    setHistory([]);
  };

  return (
    <Card className={`overflow-hidden flex flex-col ${isFullscreen ? 'fixed inset-4 z-50' : 'h-full'}`}>
      <CardHeader className="border-b bg-muted/20 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-4 w-4" />
            <CardTitle className="text-base">Shell</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCopy}
              className="h-7 w-7"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleClear}
              className="h-7 w-7"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-7 w-7"
            >
              {isFullscreen ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 bg-gray-900">
        {isRunning ? (
          <div className="h-full flex flex-col">
            <div
              ref={shellRef}
              className="flex-1 overflow-auto p-4 bg-gray-900 text-gray-100"
              style={{ minHeight: '200px' }}
            />
            <div className="border-t border-gray-800 p-2 flex items-center gap-2 bg-gray-900">
              <span className="text-green-400 font-mono text-sm">$</span>
              <input
                type="text"
                value={currentCommand}
                onChange={(e) => setCurrentCommand(e.target.value)}
                onKeyDown={handleKeyPress}
                className="flex-1 bg-transparent text-white font-mono text-sm outline-none"
                placeholder="Enter command..."
                autoFocus
              />
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <TerminalIcon className="h-12 w-12 mx-auto text-gray-600 mb-4" />
              <p className="text-sm text-gray-500">
                Run your project to access the shell
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}