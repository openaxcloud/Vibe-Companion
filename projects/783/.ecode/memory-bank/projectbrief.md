# Project Brief – Memory Bank: Real-Time Messaging Platform

## Overview
- Build a Slack-like, real-time messaging web app using TypeScript + React (front-end) and a WebSocket-enabled backend.
- Memory Bank will store and organize conversation context, enabling smart recall and future AI-assisted features.
- Support public channels, private channels, direct messages (DMs), file sharing, and typing indicators.

## Core Requirements
- Real-time messaging over WebSockets with low-latency updates.
- Channel types: public (workspace-wide), private (invite-only), and DMs (1:1 and small group).
- File sharing: upload, preview links, and metadata in messages.
- Typing indicators per channel/DM with debounced presence updates.
- Memory Bank: persistent storage of messages, threads, and conversation summaries per channel/user.

## Goals
- Provide a responsive, keyboard-friendly chat UI optimized for heavy daily use.
- Ensure reliable, ordered message delivery and consistent state across clients.
- Make historical conversations easily searchable and logically grouped.
- Architect the system to later plug in AI summarization and recommendation services using stored memory.

## Scope (v1)
- Single workspace with basic user accounts and auth.
- Web-based client only (desktop browser focus).
- Core messaging, file attachments (via external storage), and memory capture.
- No video/voice, no mobile apps, and no complex admin dashboards in v1.
