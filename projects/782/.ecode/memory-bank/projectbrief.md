# Project Brief – Memory Bank: Real-time Messaging Platform

## Overview
- Build a Slack-like real-time messaging platform in TypeScript/React.
- Core features: WebSocket-based messaging, public/private channels, direct messages (DMs), file sharing, typing indicators.
- This Memory Bank will track evolving requirements, decisions, and implementation details over the project lifecycle.

## Core Requirements
- Real-time text messaging across channels and DMs via WebSockets.
- Channel types: public (discoverable), private (invite-only), and group DMs.
- User presence: online/offline/away, plus per-conversation typing indicators.
- File attachments: upload, preview (where possible), download, with basic security.
- Authentication & authorization: secure login, role-based access to channels.

## Goals
- Deliver a performant, responsive web client with minimal latency for message delivery.
- Provide a clean, Slack-inspired UX that supports multi-channel workflows.
- Design a scalable, maintainable architecture suitable for gradual feature expansion.
- Use Memory Bank entries to capture architectural decisions (ADRs), trade-offs, and lessons learned.

## Scope
- MVP: Core messaging, channels, DMs, basic file sharing, typing indicators, and presence.
- Out of scope for MVP: voice/video calls, complex bots, marketplace-style integrations, advanced admin console.
- Future iterations may add reactions, threads, message search, and richer workspace administration.