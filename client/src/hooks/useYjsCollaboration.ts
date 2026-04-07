// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import type { EditorView } from '@codemirror/view';
import { CollaborationProvider } from '@/utils/collaboration-provider';
import { useAuth } from '@/hooks/use-auth';

interface Collaborator {
  clientId: number;
  userId: string | number;
  username: string;
  color: string;
  cursor?: {
    anchor: number;
    head: number;
  };
}

function hashStringToIndex(str: string, arrayLength: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % arrayLength;
}

interface UseYjsCollaborationOptions {
  projectId: number;
  fileId: number;
  editorView?: EditorView | null;
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#F9CA24', '#6C5CE7',
  '#A29BFE', '#FD79A8', '#FDCB6E', '#6C5CE7', '#00B894'
];

export function useYjsCollaboration({
  projectId,
  fileId,
  editorView: initialEditorView
}: UseYjsCollaborationOptions) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [followingUserId, setFollowingUserId] = useState<number | null>(null);
  const providerRef = useRef<CollaborationProvider | null>(null);
  const bindingRef = useRef<any>(null);
  const editorViewRef = useRef<EditorView | null>(initialEditorView ?? null);

  useEffect(() => {
    if (!user || !projectId || !fileId) return;

    const userColor = COLORS[hashStringToIndex(user.id, COLORS.length)];
    
    const provider = new CollaborationProvider(
      `project-${projectId}`,
      {
        userId: user.id,
        username: user.username || 'Anonymous',
        color: userColor
      }
    );
    
    providerRef.current = provider;

    provider.getProvider().on('status', ({ status }: { status: string }) => {
      setIsConnected(status === 'connected');
    });

    const unsubscribe = provider.onUsersChange((users) => {
      setCollaborators(users);
    });

    return () => {
      unsubscribe();
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      provider.destroy();
      providerRef.current = null;
    };
  }, [user, projectId, fileId]);

  useEffect(() => {
    const currentEditorView = editorViewRef.current;
    if (!currentEditorView || !providerRef.current) return;

    bindingRef.current = providerRef.current.bindCM6(currentEditorView);

    if (followingUserId !== null) {
      const collaborator = collaborators.find(c => c.userId === followingUserId);
      if (collaborator?.cursor) {
        const pos = collaborator.cursor.head;
        currentEditorView.dispatch({
          effects: [],
          selection: { anchor: pos, head: pos },
          scrollIntoView: true
        });
      }
    }

    return () => {
      if (bindingRef.current && typeof bindingRef.current.destroy === 'function') {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, [editorViewRef.current, followingUserId, collaborators]);

  const followUser = (userId: number) => {
    if (followingUserId === userId) {
      setFollowingUserId(null);
    } else {
      setFollowingUserId(userId);
    }
  };

  const setEditorView = (newEditorView: EditorView | null) => {
    editorViewRef.current = newEditorView;
  };

  return {
    collaborators,
    isConnected,
    followingUserId,
    followUser,
    setEditorView,
    editorViewRef
  };
}
