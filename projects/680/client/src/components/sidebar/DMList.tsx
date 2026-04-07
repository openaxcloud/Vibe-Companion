import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import clsx from "clsx";
import { useMessagingStore } from "../../stores/messagingStore";
import { useAuthStore } from "../../stores/authStore";

type PresenceStatus = "online" | "away" | "busy" | "offline";

interface DMParticipant {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
}

interface DMConversation {
  id: string;
  participantIds: string[];
  lastMessageAt: string | null;
  unreadCount: number;
}

interface DMWithParticipant extends DMConversation {
  participant: DMParticipant | null;
  presence: PresenceStatus;
}

interface DMListProps {
  className?: string;
  onDMSelected?: (conversationId: string) => void;
}

const presenceColorMap: Record<PresenceStatus, string> = {
  online: "bg-green-500",
  away: "bg-yellow-400",
  busy: "bg-red-500",
  offline: "bg-gray-400",
};

const presenceRingColorMap: Record<PresenceStatus, string> = {
  online: "ring-green-500/60",
  away: "ring-yellow-400/60",
  busy: "ring-red-500/60",
  offline: "ring-gray-400/40",
};

const presenceLabelMap: Record<PresenceStatus, string> = {
  online: "Online",
  away: "Away",
  busy: "Do not disturb",
  offline: "Offline",
};

const DMList: React.FC<DMListProps> = ({ className, onDMSelected }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  const conversations = useMessagingStore((state) => state.dmConversations);
  const getParticipantById = useMessagingStore(
    (state) => state.getUserById || (() => null)
  );
  const getPresenceForUser = useMessagingStore(
    (state) =>
      state.getPresenceForUser ||
      ((userId: string): PresenceStatus => {
        const presence = state.presence?.[userId];
        if (!presence) return "offline";
        if (presence.status === "online") return "online";
        if (presence.status === "away") return "away";
        if (presence.status === "busy") return "busy";
        return "offline";
      })
  );

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const activeConversationId = useMemo(() => {
    const match = location.pathname.match(/\/dm\/([^/]+)/);
    return match ? match[1] : null;
  }, [location.pathname]);

  const dmList: DMWithParticipant[] = useMemo(() => {
    if (!currentUserId) return [];

    return conversations
      .filter((conv) => conv.participantIds.includes(currentUserId))
      .map((conv) => {
        const otherId =
          conv.participantIds.find((id) => id !== currentUserId) ||
          currentUserId;
        const participant = getParticipantById(otherId);
        const presence = getPresenceForUser(otherId);
        return {
          ...conv,
          participant,
          presence,
        };
      })
      .sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [conversations, currentUserId, getParticipantById, getPresenceForUser]);

  useEffect(() => {
    if (!activeConversationId && dmList.length > 0) {
      const firstId = dmList[0]?.id;
      if (firstId) {
        navigate(`/dm/undefined`, { replace: true });
      }
    }
  }, [activeConversationId, dmList, navigate]);

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      if (conversationId === activeConversationId) return;
      if (onDMSelected) {
        onDMSelected(conversationId);
      }
      navigate(`/dm/undefined`);
    },
    [activeConversationId, navigate, onDMSelected]
  );

  const renderAvatar = (dm: DMWithParticipant) => {
    const { participant, presence } = dm;
    const initials = participant?.displayName
      ? participant.displayName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : participant?.username?.slice(0, 2).toUpperCase() || "?";

    const presenceColor = presenceColorMap[presence];
    const ringColor = presenceRingColorMap[presence];
    const presenceLabel = presenceLabelMap[presence];

    if (participant?.avatarUrl) {
      return (
        <div className="relative">
          <img
            src={participant.avatarUrl}
            alt={participant.displayName || participant.username || "User"}
            className={clsx(
              "h-9 w-9 rounded-full object-cover ring-2 transition-shadow duration-150",
              ringColor,
              hoveredId === dm.id && "ring-offset-2 ring-offset-slate-900"
            )}
          />
          <span
            className={clsx(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-slate-900",
              presenceColor
            )}
            aria-label={presenceLabel}
          />
        </div>
      );
    }

    return (
      <div className="relative">
        <div
          className={clsx(
            "flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold uppercase text-slate-100 ring-2 transition-shadow duration-150",
            ringColor,
            hoveredId === dm.id && "ring-offset-2 ring-offset-slate-900"
          )}
        >
          {initials}
        </div>
        <span
          className={clsx(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-slate-900",
            presenceColor
          )}
          aria-label={presenceLabel}
        />
      </div>
    );
  };

  const renderPresenceText = (presence: PresenceStatus) => {
    switch (presence) {
      case "online":
        return "Online";
      case "away":
        return "Away";
      case "busy":
        return "Do not disturb";
      case "offline":
      default:
        return "Offline";
    }
  };

  return (
    <div
      className={clsx(
        "flex h-full flex-col overflow-hidden border-r border-slate-800 bg-slate-900/95",
        className
      )}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Direct Messages
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto pb-2">
        {dmList.length === 0 && (
          <div className="px-3 py-2 text-xs text-slate-500">
            No direct messages yet.
          </div>
        )}
        <ul className="space-y-0.5">
          {dmList.map((dm) => {
            const isActive = dm.id === activeConversationId;
            const participantName =
              dm.participant?.displayName ||
              dm.participant?.username ||
              "Unknown user";

            return (
              <li key={dm.id}>
                <button
                  type="button"
                  onClick={() => handleSelectConversation(dm.id)}
                  onMouseEnter={() => setHoveredId(dm.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={clsx(
                    "group flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors",
                    isActive
                      ? "bg-slate-800 text-slate-50"
                      : "text-slate-200 hover:bg-slate-800/70"
                  )}
                >
                  {renderAvatar(dm)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">
                        {participantName}
                      </span>
                      {dm.unreadCount > 0 && (
                        <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-white">
                          {dm.unreadCount > 99 ? "99+" : dm.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center