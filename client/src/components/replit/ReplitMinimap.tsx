import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface MinimapProps {
  content: string;
  currentLine?: number;
  visibleRange?: { start: number; end: number };
  onLineClick?: (line: number) => void;
  className?: string;
}

export function ReplitMinimap({
  content,
  currentLine = 1,
  visibleRange,
  onLineClick,
  className
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const lines = content.split('\n');
  const lineHeight = 2; // Height of each line in the minimap
  const padding = 4;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Set device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = 'var(--ecode-background)';
    ctx.fillRect(0, 0, containerWidth, containerHeight);

    // Calculate total height needed for all lines
    const totalHeight = lines.length * lineHeight + padding * 2;
    const scale = Math.min(1, (containerHeight - padding * 2) / (lines.length * lineHeight));

    // Draw lines
    lines.forEach((line, index) => {
      const y = padding + index * lineHeight * scale;
      const lineNumber = index + 1;
      
      // Determine line color based on content
      let color = '#6B7280'; // Default gray
      
      if (line.trim().length === 0) {
        color = 'transparent'; // Empty lines
      } else if (line.trim().startsWith('//') || line.trim().startsWith('/*')) {
        color = '#10B981'; // Comments - green
      } else if (line.includes('function') || line.includes('const') || line.includes('let')) {
        color = '#3B82F6'; // Keywords - blue
      } else if (line.includes('{') || line.includes('}')) {
        color = '#F59E0B'; // Braces - amber
      } else if (line.includes('import') || line.includes('export')) {
        color = '#8B5CF6'; // Imports/exports - purple
      } else if (line.trim().length > 80) {
        color = '#EF4444'; // Long lines - red
      }

      // Draw line
      ctx.fillStyle = color;
      const lineWidth = Math.max(1, Math.min(containerWidth - padding * 2, (line.length / 100) * (containerWidth - padding * 2)));
      ctx.fillRect(padding, y, lineWidth, Math.max(1, lineHeight * scale));

      // Highlight current line
      if (lineNumber === currentLine) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; // Blue highlight
        ctx.fillRect(0, y, containerWidth, Math.max(2, lineHeight * scale));
      }

      // Highlight visible range
      if (visibleRange && lineNumber >= visibleRange.start && lineNumber <= visibleRange.end) {
        ctx.fillStyle = 'rgba(156, 163, 175, 0.1)'; // Gray highlight for visible area
        ctx.fillRect(0, y, containerWidth, Math.max(1, lineHeight * scale));
      }
    });

    // Draw scrollbar indicator for visible range
    if (visibleRange) {
      const startY = padding + (visibleRange.start - 1) * lineHeight * scale;
      const endY = padding + visibleRange.end * lineHeight * scale;
      const height = endY - startY;

      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(containerWidth - 4, startY, 2, height);
    }

  }, [content, currentLine, visibleRange, lines]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onLineClick) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const y = event.clientY - rect.top;
    
    const containerHeight = rect.height;
    const scale = Math.min(1, (containerHeight - padding * 2) / (lines.length * lineHeight));
    
    const clickedLine = Math.floor((y - padding) / (lineHeight * scale)) + 1;
    const clampedLine = Math.max(1, Math.min(lines.length, clickedLine));
    
    onLineClick(clampedLine);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-20 h-full bg-[var(--ecode-background)] border-l border-[var(--ecode-border)] relative overflow-hidden",
        "hover:bg-[var(--ecode-surface)] transition-colors",
        className
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onClick={handleClick}
        title="Code minimap - click to navigate"
      />
      
      {/* Hover overlay with line numbers */}
      {isHovering && (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-2 left-1 text-[11px] text-[var(--ecode-text-secondary)]">
            {lines.length} lines
          </div>
          {currentLine && (
            <div className="absolute bottom-2 left-1 text-[11px] text-[var(--ecode-accent)]">
              Line {currentLine}
            </div>
          )}
        </div>
      )}
    </div>
  );
}