import React, { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import WorkspaceLayout from "../layouts/WorkspaceLayout";
import Sidebar from "../components/sidebar/Sidebar";
import ChatView from "../components/chat/ChatView";
import { useWorkspace } from "../hooks/useWorkspace";
import { useMessages } from "../hooks/useMessages";
import { useAuth } from "../hooks/useAuth";

export interface WorkspacePageParams {
  workspaceId?: string;
  channelId?: string;
}

const WorkspacePage: React.FC = () => {
  const navigate = useNavigate();
  const { workspaceId, channelId } = useParams<WorkspacePageParams>();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    workspaces,
    currentWorkspace,
    channels,
    setCurrentWorkspaceById,
    setCurrentChannelById,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace();
  const {
    messages,
    isLoading: messagesLoading,
    error: messagesError,
    loadMessages,
    sendMessage,
    hasMore,
    loadOlderMessages,
  } = useMessages();

  const activeChannelId = useMemo<string | undefined>(() => {
    if (channelId) return channelId;
    const queryChannel = searchParams.get("channelId");
    return queryChannel || undefined;
  }, [channelId, searchParams]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!workspaceId || !workspaces.length) return;
    setCurrentWorkspaceById(workspaceId);
  }, [workspaceId, workspaces, setCurrentWorkspaceById]);

  useEffect(() => {
    if (!activeChannelId || !channels.length) return;
    setCurrentChannelById(activeChannelId);
  }, [activeChannelId, channels, setCurrentChannelById]);

  useEffect(() => {
    if (!currentWorkspace || !activeChannelId) return;
    loadMessages({ workspaceId: currentWorkspace.id, channelId: activeChannelId });
  }, [currentWorkspace, activeChannelId, loadMessages]);

  const handleSelectWorkspace = useCallback(
    (id: string) => {
      const targetWorkspace = workspaces.find((w) => w.id === id);
      const defaultChannel = targetWorkspace?.defaultChannelId || "";
      navigate(`/workspace/undefinedundefined` : ""}`);
    },
    [navigate, workspaces]
  );

  const handleSelectChannel = useCallback(
    (id: string) => {
      if (!currentWorkspace) return;
      navigate(`/workspace/undefined/channel/undefined`);
    },
    [currentWorkspace, navigate]
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!currentWorkspace || !activeChannelId || !user) return;
      await sendMessage({
        workspaceId: currentWorkspace.id,
        channelId: activeChannelId,
        content,
        authorId: user.id,
      });
    },
    [currentWorkspace, activeChannelId, user, sendMessage]
  );

  const handleLoadOlderMessages = useCallback(() => {
    if (!currentWorkspace || !activeChannelId) return;
    loadOlderMessages({ workspaceId: currentWorkspace.id, channelId: activeChannelId });
  }, [currentWorkspace, activeChannelId, loadOlderMessages]);

  const isInitialLoading =
    authLoading || workspaceLoading || (messagesLoading && !messages.length);

  const combinedError = useMemo(() => {
    if (workspaceError) return workspaceError;
    if (messagesError) return messagesError;
    return null;
  }, [workspaceError, messagesError]);

  if (!isAuthenticated && !authLoading) {
    return null;
  }

  return (
    <WorkspaceLayout
      isLoading={isInitialLoading}
      error={combinedError}
      sidebar={
        <Sidebar
          workspaces={workspaces}
          currentWorkspaceId={currentWorkspace?.id}
          channels={channels}
          currentChannelId={activeChannelId}
          onSelectWorkspace={handleSelectWorkspace}
          onSelectChannel={handleSelectChannel}
        />
      }
      content={
        <ChatView
          messages={messages}
          isLoading={messagesLoading}
          hasMore={hasMore}
          onSendMessage={handleSendMessage}
          onLoadOlderMessages={handleLoadOlderMessages}
          currentWorkspace={currentWorkspace || null}
          currentChannelId={activeChannelId || null}
        />
      }
    />
  );
};

export default WorkspacePage;