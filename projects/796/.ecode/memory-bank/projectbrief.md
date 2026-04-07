# Project Brief – Real‑Time Messaging Platform (Memory Bank Overview)

## Overview
- Build a Slack‑like real‑time messaging web app using TypeScript + React for the client.
- Core capabilities: public/private channels, direct messages (DMs), file sharing, typing indicators, presence, and message history.
- System should support multi-tenant workspaces (extendable later) and scale to thousands of concurrent users.

## Core Requirements
- Real-time communication via WebSockets (or WebSocket-capable abstraction like Socket.IO).
- Authentication + basic workspace/user management.
- Channel types: public (discoverable), private (invite‑only), DMs (1:1 and small group).
- Message features: text, attachments, reactions (stretch), message threading (future), edit/delete.
- Real‑time states: typing indicators, online/offline presence, read states (future).

## Non‑Functional Goals
- Low latency messaging with reliable delivery semantics.
- Horizontally scalable and fault tolerant WebSocket handling.
- Clear separation of concerns: API, real‑time gateway, web client.
- Secure by default: authN, authZ, secure file links, rate limiting.

## Scope for Initial Iteration
- Single workspace, email/password auth, basic profile.
- Channel list, message list, composer, file upload, typing indicator.
- Minimal admin: create channels, add/remove members.
- Memory Bank: persist concepts, decisions, and patterns derived from this brief for reuse in future tasks.
