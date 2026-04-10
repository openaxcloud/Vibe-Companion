import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { yCollab } from 'y-codemirror.next';
import * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';

export const userColors: string[] = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#F9CA24',
  '#6C5CE7',
  '#A29BFE',
  '#FD79A8',
  '#FDCB6E',
  '#00B894',
  '#E17055',
  '#74B9FF',
  '#55EFC4',
  '#FFEAA7',
  '#DFE6E9',
  '#B2BEC3',
  '#636E72',
];

export interface CollaborationOptions {
  doc: Y.Doc;
  provider: any;
  userId: string;
  userName: string;
  userColor: string;
  awareness: Awareness;
  textField?: string;
}

export interface Collaborator {
  clientId: number;
  userId: string;
  name: string;
  color: string;
  colorLight: string;
  cursor?: {
    anchor: number;
    head: number;
  };
}

export interface CollaborationState {
  ytext: Y.Text;
  awareness: Awareness;
  provider: any;
  undoManager: Y.UndoManager | null;
}

let activeCollaborationState: CollaborationState | null = null;

export function createCollaborationExtension(options: CollaborationOptions): Extension[] {
  const textField = options.textField || 'content';
  const ytext = options.doc.getText(textField);
  
  const colorLight = options.userColor + '33';
  
  options.awareness.setLocalStateField('user', {
    userId: options.userId,
    name: options.userName,
    color: options.userColor,
    colorLight: colorLight,
  });

  const undoManager = new Y.UndoManager(ytext, {
    trackedOrigins: new Set([options.awareness.clientID]),
    captureTimeout: 500,
  });

  activeCollaborationState = {
    ytext,
    awareness: options.awareness,
    provider: options.provider,
    undoManager,
  };

  const collaborationExtension = yCollab(ytext, options.awareness, {
    undoManager,
  });

  const cursorStyleExtension = EditorView.theme({
    '.cm-ySelectionInfo': {
      position: 'absolute',
      top: '-1.05em',
      left: '-1px',
      fontSize: '0.75em',
      fontFamily: 'sans-serif',
      fontWeight: '600',
      lineHeight: 'normal',
      userSelect: 'none',
      padding: '0 4px',
      borderRadius: '3px 3px 3px 0',
      zIndex: '101',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    },
    '.cm-ySelection': {
      mixBlendMode: 'multiply',
    },
    '.cm-yCursor': {
      position: 'relative',
      borderLeft: '2px solid',
      borderRight: 'none',
      marginLeft: '-1px',
      marginRight: '-1px',
      pointerEvents: 'none',
    },
    '.cm-ySelectionCaret': {
      position: 'relative',
      borderLeft: '2px solid',
      borderRight: 'none',
      marginLeft: '-1px',
      marginRight: '-1px',
      height: '1em',
    },
    '.cm-yLineSelection': {
      padding: 0,
      margin: 0,
    },
  });

  return [collaborationExtension, cursorStyleExtension];
}

export function createCollaborationExtensionSimple(
  ytext: Y.Text,
  awareness: Awareness,
  userInfo: { userId: string; name: string; color: string }
): Extension[] {
  const colorLight = userInfo.color + '33';
  
  awareness.setLocalStateField('user', {
    userId: userInfo.userId,
    name: userInfo.name,
    color: userInfo.color,
    colorLight: colorLight,
  });

  const undoManager = new Y.UndoManager(ytext, {
    trackedOrigins: new Set([awareness.clientID]),
    captureTimeout: 500,
  });

  activeCollaborationState = {
    ytext,
    awareness,
    provider: null,
    undoManager,
  };

  const collaborationExtension = yCollab(ytext, awareness, {
    undoManager,
  });

  const cursorStyleExtension = EditorView.theme({
    '.cm-ySelectionInfo': {
      position: 'absolute',
      top: '-1.05em',
      left: '-1px',
      fontSize: '0.75em',
      fontFamily: 'sans-serif',
      fontWeight: '600',
      lineHeight: 'normal',
      userSelect: 'none',
      padding: '0 4px',
      borderRadius: '3px 3px 3px 0',
      zIndex: '101',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    },
    '.cm-ySelection': {
      mixBlendMode: 'multiply',
    },
    '.cm-yCursor': {
      position: 'relative',
      borderLeft: '2px solid',
      borderRight: 'none',
      marginLeft: '-1px',
      marginRight: '-1px',
      pointerEvents: 'none',
    },
  });

  return [collaborationExtension, cursorStyleExtension];
}

export function disconnectCollaboration(): void {
  if (activeCollaborationState) {
    if (activeCollaborationState.undoManager) {
      activeCollaborationState.undoManager.destroy();
    }
    
    activeCollaborationState.awareness.setLocalState(null);
    
    if (activeCollaborationState.provider) {
      if (typeof activeCollaborationState.provider.disconnect === 'function') {
        activeCollaborationState.provider.disconnect();
      } else if (typeof activeCollaborationState.provider.destroy === 'function') {
        activeCollaborationState.provider.destroy();
      }
    }
    
    activeCollaborationState = null;
  }
}

export function getCollaborators(awareness: Awareness): Collaborator[] {
  const collaborators: Collaborator[] = [];
  const states = awareness.getStates();
  const localClientId = awareness.clientID;

  states.forEach((state: any, clientId: number) => {
    if (clientId !== localClientId && state.user) {
      const user = state.user;
      collaborators.push({
        clientId,
        userId: user.userId || String(clientId),
        name: user.name || 'Anonymous',
        color: user.color || userColors[clientId % userColors.length],
        colorLight: user.colorLight || (user.color ? user.color + '33' : userColors[clientId % userColors.length] + '33'),
        cursor: state.cursor,
      });
    }
  });

  return collaborators;
}

export function getLocalUser(awareness: Awareness): Collaborator | null {
  const localState = awareness.getLocalState();
  if (!localState?.user) {
    return null;
  }

  const user = localState.user;
  return {
    clientId: awareness.clientID,
    userId: user.userId || String(awareness.clientID),
    name: user.name || 'Anonymous',
    color: user.color || userColors[0],
    colorLight: user.colorLight || (user.color ? user.color + '33' : userColors[0] + '33'),
    cursor: localState.cursor,
  };
}

export function updateLocalUser(
  awareness: Awareness,
  updates: Partial<{ name: string; color: string }>
): void {
  const currentState = awareness.getLocalState();
  const currentUser = currentState?.user || {};

  awareness.setLocalStateField('user', {
    ...currentUser,
    ...updates,
    colorLight: updates.color ? updates.color + '33' : currentUser.colorLight,
  });
}

export function updateLocalCursor(
  awareness: Awareness,
  cursor: { anchor: number; head: number } | null
): void {
  awareness.setLocalStateField('cursor', cursor);
}

export function onCollaboratorsChange(
  awareness: Awareness,
  callback: (collaborators: Collaborator[]) => void
): () => void {
  const handler = () => {
    const collaborators = getCollaborators(awareness);
    callback(collaborators);
  };

  awareness.on('change', handler);
  
  handler();

  return () => {
    awareness.off('change', handler);
  };
}

export function hashStringToColorIndex(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % userColors.length;
}

export function getColorForUser(userId: string): string {
  return userColors[hashStringToColorIndex(userId)];
}

export function getActiveCollaborationState(): CollaborationState | null {
  return activeCollaborationState;
}

export function undo(): boolean {
  if (activeCollaborationState?.undoManager) {
    activeCollaborationState.undoManager.undo();
    return true;
  }
  return false;
}

export function redo(): boolean {
  if (activeCollaborationState?.undoManager) {
    activeCollaborationState.undoManager.redo();
    return true;
  }
  return false;
}

export function canUndo(): boolean {
  if (activeCollaborationState?.undoManager) {
    return activeCollaborationState.undoManager.undoStack.length > 0;
  }
  return false;
}

export function canRedo(): boolean {
  if (activeCollaborationState?.undoManager) {
    return activeCollaborationState.undoManager.redoStack.length > 0;
  }
  return false;
}
