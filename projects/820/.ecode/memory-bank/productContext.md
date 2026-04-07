# Product & UX Context

## Problem Statement
- Teams need a lightweight, always-on communication hub similar to Slack but tailored for focused, small-to-mid-sized organizations.
- Existing tools can be heavy, costly, or over-featured; this app targets core messaging and collaboration only.

## Target Users
- Small software teams (5–50 people) collaborating daily.
- Project-based groups (agencies, student teams, internal task forces).
- Users are moderately technical, used to chat tools (Slack/Discord/MS Teams).

## UX Goals
- Zero-learning-curve messaging: familiar layout (sidebar channels, message list, composer area).
- Fast perception of real-time state: typing indicators, presence dots, subtle toasts.
- Simple file sharing: drag-and-drop uploads, inline previews where possible.
- Clear separation between public channels, private channels, and DMs.

## Key User Flows
1. **Onboarding & Auth**
   - User signs up/logs in, sets display name and avatar, is placed into a default workspace and general channel.
2. **Channel Navigation**
   - Browse/join public channels; see membership in private channels by invite only.
   - Switch channels with preserved scroll position and last-read marker.
3. **Messaging & Presence**
   - Send text messages and attachments to a selected channel or DM.
   - See new messages in real time via WebSocket.
   - Observe who is online and who is typing in the active conversation.
4. **Direct Messages**
   - Start a DM from member list or user profile.
   - Continue past conversations with history preserved and searchable (MVP: basic search or scrolling).
5. **File Sharing**
   - Upload files from message composer.
   - View file metadata (name, size, type) and preview for images (MVP).
   - Download/access attachments reliably.

## Non-Goals (UX)
- Complex notification settings and granular per-channel muting (MVP: simple global toggle).
- Power-user features like slash commands, custom emoji, or bots in first iteration.