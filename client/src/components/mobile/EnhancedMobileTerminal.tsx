import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, RotateCcw } from 'lucide-react';

interface TerminalLine {
  id: number;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
}

export function EnhancedMobileTerminal({ projectId }: { projectId: string }) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 0, type: 'system', content: `Connected to project terminal` },
  ]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lineIdRef = useRef(1);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines]);

  const runCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim()) return;
    const inputId = lineIdRef.current++;
    setLines(prev => [...prev, { id: inputId, type: 'input', content: `$ ${cmd}` }]);
    setInput('');
    setRunning(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json();
      const outputId = lineIdRef.current++;
      if (data.output || data.stdout) {
        setLines(prev => [...prev, { id: outputId, type: 'output', content: data.output || data.stdout || '' }]);
      }
      if (data.stderr || data.error) {
        setLines(prev => [...prev, { id: lineIdRef.current++, type: 'error', content: data.stderr || data.error }]);
      }
      if (!data.output && !data.stdout && !data.stderr && !data.error) {
        setLines(prev => [...prev, { id: outputId, type: 'system', content: `Exit code: ${data.exitCode ?? 0}` }]);
      }
    } catch (err) {
      setLines(prev => [...prev, { id: lineIdRef.current++, type: 'error', content: `Error: ${err instanceof Error ? err.message : 'Command failed'}` }]);
    }
    setRunning(false);
  }, [projectId]);

  const clearTerminal = () => {
    setLines([{ id: lineIdRef.current++, type: 'system', content: 'Terminal cleared' }]);
  };

  const colorMap = { input: 'text-white', output: 'text-green-300', error: 'text-red-400', system: 'text-gray-500' };

  return (
    <div className="h-full bg-black flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#111] border-b border-[#333]">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Terminal</span>
        <div className="flex items-center gap-2">
          <button onClick={clearTerminal} className="text-gray-500 hover:text-gray-300"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 mobile-scroll">
        {lines.map(line => (
          <pre key={line.id} className={`text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all ${colorMap[line.type]}`}>
            {line.content}
          </pre>
        ))}
        {running && <span className="text-[11px] text-gray-500 font-mono animate-pulse">Running...</span>}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 bg-[#111] border-t border-[#333]">
        <span className="text-green-400 text-[11px] font-mono shrink-0">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') runCommand(input); }}
          placeholder="Type command..."
          enterKeyHint="send"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 bg-transparent text-[12px] text-white font-mono placeholder:text-gray-600 outline-none"
          disabled={running}
        />
        <button onClick={() => runCommand(input)} disabled={running || !input.trim()} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30">
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
