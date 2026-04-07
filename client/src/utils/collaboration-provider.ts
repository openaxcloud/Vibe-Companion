import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { yCollab } from 'y-codemirror.next';
import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

export class CollaborationProvider {
  private doc: Y.Doc;
  private provider: WebsocketProvider;
  private awareness: any;
  private undoManager: Y.UndoManager | null = null;

  constructor(
    roomName: string,
    userInfo: { userId: string | number; username: string; color: string }
  ) {
    this.doc = new Y.Doc();
    
    // Get WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/collaboration`;
    
    // Create WebSocket provider with authentication info
    this.provider = new WebsocketProvider(wsUrl, roomName, this.doc, {
      params: {
        userId: userInfo.userId.toString(),
        username: userInfo.username
      }
    });
    
    this.awareness = this.provider.awareness;
    
    // Set local user info in awareness
    this.awareness.setLocalStateField('user', {
      userId: userInfo.userId,
      name: userInfo.username,
      color: userInfo.color,
      colorLight: userInfo.color + '33'
    });
  }

  public bindCM6(view: EditorView, textField: string = 'content'): Extension {
    // Get the Yjs text type
    const ytext = this.doc.getText(textField);
    
    // Create undo manager for collaborative editing
    this.undoManager = new Y.UndoManager(ytext, {
      trackedOrigins: new Set([this.awareness.clientID]),
      captureTimeout: 500,
    });
    
    // Create CM6 collaboration extension using yCollab
    return yCollab(ytext, this.awareness, {
      undoManager: this.undoManager,
    });
  }

  public getAwareness() {
    return this.awareness;
  }

  public getDoc() {
    return this.doc;
  }

  public getProvider() {
    return this.provider;
  }

  public getUndoManager() {
    return this.undoManager;
  }

  public destroy() {
    if (this.undoManager) {
      this.undoManager.destroy();
    }
    this.awareness.setLocalState(null);
    this.provider.destroy();
    this.doc.destroy();
  }

  public onUsersChange(callback: (users: any[]) => void) {
    const updateUsers = () => {
      const states = this.awareness.getStates();
      const users: any[] = [];
      
      states.forEach((state: any, clientId: number) => {
        if (state.user && clientId !== this.awareness.clientID) {
          users.push({
            clientId,
            ...state.user,
            cursor: state.cursor
          });
        }
      });
      
      callback(users);
    };
    
    this.awareness.on('change', updateUsers);
    updateUsers(); // Initial update
    
    return () => {
      this.awareness.off('change', updateUsers);
    };
  }

  public sendCursorUpdate(anchor: number, head: number) {
    this.awareness.setLocalStateField('cursor', {
      anchor,
      head
    });
  }
}
