# Memory Bank – Product Context

## Problem Statement
- The project is a Slack-like messaging platform with rich collaboration features.
- Product decisions (channels, DMs, threads, presence, reactions, file sharing, notifications) are numerous and interdependent.
- Without a structured memory, UX and feature behavior can easily become inconsistent across the app.

## Target Users for Memory Bank
- Developers defining APIs, WebSocket events, and UI behavior.
- Designers specifying interaction patterns (threading, reactions, read receipts, typing indicators).
- Product owners tracking scope and priorities for messaging features.

## UX & Behavior Knowledge to Capture
- Canonical flows: joining public/private channels, starting DMs, uploading files/images, reacting, starting threads.
- Consistent rules for presence (online/away/offline), typing indicators, and read receipts across web and mobile.
- Notification semantics: which events trigger in-app vs. push notifications and how they are batched or muted.

## Key User Flows to Remember
- Real-time messaging in a channel (send/edit/delete, reactions, threads, typing).
- Direct messages and group DMs, including read receipts and presence.
- File/image sharing with previews and permission rules.
- Cross-device experience: consistent state between browser sessions and push notifications.
