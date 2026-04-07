# Project Brief – Memory Bank: Real‑Time Messaging Platform

## Overview
- Memory Bank is a Slack‑like real-time messaging platform enabling teams to communicate via channels and direct messages.
- Core capabilities: WebSocket-based messaging, public/private channels, DMs, file & image sharing, message reactions, threading, typing indicators, read receipts, presence status, and push notifications.
- Built as a full-stack TypeScript app with a React frontend.

## Core Requirements
- Real-time message delivery and updates for channels and DMs via WebSockets.
- Channel model: public (searchable, joinable) and private (invite-only) workspaces.
- Direct & group DMs: 1:1 and small multi-user conversations.
- Message primitives: text, files, images, reactions, editable/deletable messages, threads.
- User feedback: typing indicators, read receipts, presence (online/away/offline), and push notifications.
- Robust auth: secure login, JWT/session, role-based permissions at org / channel level.

## Goals
- Provide a responsive, low-latency messaging experience across web clients.
- Deliver an intuitive UX that scales from small teams to larger organizations.
- Achieve high reliability with graceful handling of disconnects and reconnections.
- Make the system observable: logs, metrics, and structured events.

## Scope (Initial Release)
- Single-tenant workspace model (one organization) with users, channels, and DMs.
- Web app client only (mobile via responsive web; native push later).
- Basic admin tools: channel management, user deactivation, simple audit logs.
- Persistent storage of messages, threads, files (via cloud storage) and user metadata.
- Out-of-scope initially: advanced search (full-text across history), bots/apps marketplace, SSO.
