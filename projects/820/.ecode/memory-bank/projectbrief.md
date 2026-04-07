# Project Brief: Real-Time Messaging Platform (Slack-like)

## Overview
- Build a Slack-like real-time messaging web app with channels, DMs, and rich collaboration features.
- Frontend: TypeScript + React SPA connecting to a WebSocket-enabled backend (language/stack TBD).
- Focus on responsive, low-latency messaging with strong channel organization and presence feedback.

## Core Requirements
- User authentication and basic profile (name, avatar, status).
- Public channels (workspace-wide visibility) and private channels (invite-only).
- Direct messages (1:1 and small group DMs).
- Real-time messaging via WebSocket, with message persistence.
- Typing indicators, online/offline presence, and read state basics (per-channel last-read cursor).
- File sharing: upload attachments in channels/DMs with previews and download links.

## Goals
- Deliver a usable MVP that supports a small team’s daily communication.
- Prioritize reliability, responsiveness, and intuitive UX over advanced features.
- Design an architecture that can scale horizontally as usage grows.

## Out of Scope (for now)
- Threaded conversations, reactions, and rich app integrations.
- Enterprise features (SSO, workspace admin analytics, compliance exports).
- Mobile-native clients (web is primary, but responsive design is expected).

## Success Criteria
- Users can sign in, join channels, send/receive messages, and share files in real time.
- WebSocket connections remain stable under typical team load (tens to low hundreds of concurrent users).
- Latency from send to receive under normal conditions feels near-instant (<300ms typical).