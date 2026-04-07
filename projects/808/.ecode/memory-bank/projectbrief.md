# Project Brief: Real-Time Messaging Platform

## Overview
- Build a Slack-like real-time messaging platform using TypeScript and React.
- Core collaboration features: public/private channels, direct messages, file sharing, typing indicators.
- Deliver a modern, responsive web client optimized for desktop use.

## Core Requirements
- User authentication, profiles, and presence (online/away/offline).
- Real-time messaging via WebSockets (or WebSocket-compatible service).
- Channel types: public (discoverable) and private (invite-only).
- 1:1 and small-group direct messages.
- File uploads with previews and secure downloads.
- Typing indicators for channels and DMs.
- Message history with basic search and pagination.

## Goals
- Provide fast, reliable, low-latency messaging UX.
- Keep architecture modular to support future mobile clients.
- Ensure security: authz on channels/DMs, rate limiting, safe file handling.

## Out of Scope (Initial Version)
- Voice/video calls, screen sharing.
- Advanced admin features (auditing, compliance export).
- Extensive integrations (bots, 3rd-party apps).

## Success Criteria
- Stable real-time experience with <1s perceived latency under normal load.
- No unauthorized access to private channels or DMs.
- Clear, intuitive navigation between workspaces, channels, and DMs.
