/**
 * E-Code Collaborator Cursors Component
 * Fortune 500 Quality Editor Integration
 * 
 * Renders remote collaborator cursors and selections in CodeMirror 6 Editor
 * Note: Primary cursor rendering is handled by y-codemirror.next via the collaboration adapter.
 * This component provides additional CSS styling and the "follow user" feature.
 * 
 * Features:
 * - Enhanced cursor styling (complements y-codemirror.next)
 * - Follow user cursor scrolling
 * - Mobile-friendly touch targets
 */

import { useEffect, useRef, memo } from 'react';
import { EditorView } from '@codemirror/view';
import { Collaborator } from '@/hooks/useRealTimeCollaboration';

interface CollaboratorCursorsProps {
  editor: EditorView | null;
  collaborators: Collaborator[];
  followingUserId?: string | null;
  onFollowCursor?: (position: { lineNumber: number; column: number }) => void;
}

const cursorStyles = `
  .collaborator-cursor {
    position: relative;
    pointer-events: none;
  }
  
  .collaborator-cursor-line {
    position: absolute;
    width: 2px;
    height: 18px;
    animation: cursor-blink 1s ease-in-out infinite;
  }
  
  .collaborator-cursor-label {
    position: absolute;
    top: -18px;
    left: 0;
    padding: 1px 6px;
    font-size: 10px;
    font-weight: 500;
    border-radius: 3px 3px 3px 0;
    white-space: nowrap;
    color: white;
    z-index: 10;
    pointer-events: none;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  
  .collaborator-selection {
    opacity: 0.3;
  }
  
  @keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  /* Enhanced y-codemirror.next cursor styles */
  .cm-ySelectionInfo {
    animation: cursor-label-fade-in 0.2s ease-out;
  }
  
  .cm-yCursor {
    animation: cursor-blink 1s ease-in-out infinite;
  }
  
  @keyframes cursor-label-fade-in {
    from { opacity: 0; transform: translateY(-2px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @media (max-width: 768px) {
    .collaborator-cursor-label {
      font-size: 9px;
      padding: 2px 4px;
    }
    
    .cm-ySelectionInfo {
      font-size: 9px !important;
      padding: 2px 4px !important;
    }
  }
`;

function injectCursorStyles() {
  const styleId = 'collaborator-cursor-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = cursorStyles;
    document.head.appendChild(style);
  }
}

function lineColumnToPos(view: EditorView, lineNumber: number, column: number): number {
  try {
    const doc = view.state.doc;
    const maxLine = doc.lines;
    const clampedLine = Math.max(1, Math.min(lineNumber, maxLine));
    const line = doc.line(clampedLine);
    const clampedColumn = Math.max(1, Math.min(column, line.length + 1));
    return line.from + clampedColumn - 1;
  } catch {
    return 0;
  }
}

export const CollaboratorCursors = memo(function CollaboratorCursors({
  editor,
  collaborators,
  followingUserId,
  onFollowCursor
}: CollaboratorCursorsProps) {
  const styleInjectedRef = useRef(false);

  useEffect(() => {
    if (!styleInjectedRef.current) {
      injectCursorStyles();
      styleInjectedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!editor) return;

    collaborators.forEach((collaborator) => {
      const { color, username, odUserId } = collaborator;

      const existingStyle = document.getElementById(`cursor-style-${odUserId}`);
      if (existingStyle) existingStyle.remove();

      const dynamicStyle = document.createElement('style');
      dynamicStyle.id = `cursor-style-${odUserId}`;
      dynamicStyle.textContent = `
        .collaborator-cursor-line[data-user="${odUserId}"] {
          background-color: ${color};
        }
        .collaborator-cursor-indicator-${odUserId}::before {
          content: '';
          position: absolute;
          left: -2px;
          top: 0;
          width: 2px;
          height: 100%;
          background-color: ${color};
          animation: cursor-blink 1s ease-in-out infinite;
        }
        .collaborator-cursor-indicator-${odUserId}::after {
          content: '${username}';
          position: absolute;
          left: -2px;
          top: -16px;
          padding: 1px 5px;
          font-size: 10px;
          font-weight: 500;
          border-radius: 3px 3px 3px 0;
          background-color: ${color};
          color: white;
          white-space: nowrap;
          z-index: 100;
        }
      `;
      document.head.appendChild(dynamicStyle);
    });

    return () => {
      collaborators.forEach((collaborator) => {
        const style = document.getElementById(`cursor-style-${collaborator.odUserId}`);
        if (style) style.remove();
      });
    };
  }, [editor, collaborators]);

  useEffect(() => {
    if (!editor || !followingUserId || !onFollowCursor) return;

    const followedUser = collaborators.find(c => c.odUserId.toString() === followingUserId);
    if (followedUser?.cursor) {
      const { lineNumber, column } = followedUser.cursor;
      const pos = lineColumnToPos(editor, lineNumber, column);
      
      editor.dispatch({
        effects: EditorView.scrollIntoView(pos, { y: 'center' })
      });
      
      onFollowCursor(followedUser.cursor);
    }
  }, [editor, followingUserId, collaborators, onFollowCursor]);

  return null;
});

export default CollaboratorCursors;
