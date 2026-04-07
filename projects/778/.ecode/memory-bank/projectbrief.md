# Memory Bank – Project Brief

## Overview
- Memory Bank is the long-term knowledge store for a Slack-like real-time messaging platform built with TypeScript and React.
- It captures, structures, and recalls information about architecture, decisions, constraints, and UX expectations over the project lifetime.
- Primary goal: keep the assistant and team consistently aligned while the app evolves from MVP to production.

## Core Requirements
- Persist key product decisions: channels, DMs, file sharing, reactions, threads, presence, typing, read receipts, notifications.
- Track evolving architecture: real-time WebSocket layer, API boundaries, data models, and auth/session strategies.
- Store constraints: TypeScript + React stack, real-time performance expectations, scalability assumptions.
- Maintain a history of trade-offs: what was considered, accepted, or rejected (e.g., choice of state management, WebSocket library, notification service).

## Goals
- Reduce design drift: ensure new features follow previously agreed patterns.
- Speed up onboarding: new contributors can read Memory Bank instead of rediscovering context.
- Improve decision quality: make it easy to revisit and adjust older choices with full context.

## Scope
- Covers architecture, product, and process knowledge; not source code.
- Focused on this messaging platform only (no generic templates).
- Updated incrementally in small, atomic entries tied to milestones and features.
