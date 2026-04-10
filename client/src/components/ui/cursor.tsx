import React, { useEffect, useState } from 'react';

interface CursorPosition {
  lineNumber: number;
  column: number;
}

interface RemoteCursorProps {
  position: CursorPosition;
  username: string;
  color: string;
  editorElement: HTMLElement | null;
  lineHeight: number;
  charWidth: number;
}

export function RemoteCursor({
  position,
  username,
  color,
  editorElement,
  lineHeight,
  charWidth,
}: RemoteCursorProps) {
  const [style, setStyle] = useState<React.CSSProperties>({
    display: 'none',
  });

  useEffect(() => {
    if (!editorElement) return;

    // Calculate position
    const top = (position.lineNumber - 1) * lineHeight;
    const left = (position.column - 1) * charWidth;

    // Set style
    setStyle({
      position: 'absolute',
      top: `${top}px`,
      left: `${left}px`,
      height: `${lineHeight}px`,
      width: '2px',
      backgroundColor: color,
      zIndex: 10,
      pointerEvents: 'none',
    });
  }, [position, editorElement, lineHeight, charWidth, color]);

  if (!editorElement) return null;

  return (
    <div style={style} className="remote-cursor">
      <div
        style={{
          position: 'absolute',
          top: '-20px',
          left: '0',
          backgroundColor: color,
          color: '#fff',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {username}
      </div>
    </div>
  );
}

// Local cursor component (this is for future use if needed)
interface LocalCursorProps {
  position: CursorPosition;
}

export function LocalCursor({ position }: LocalCursorProps) {
  return null; // We don't need to render a local cursor since Monaco already shows one
}