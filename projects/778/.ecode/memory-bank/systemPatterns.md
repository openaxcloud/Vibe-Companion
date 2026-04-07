# Memory Bank – System & Patterns

## Role in the Architecture
- Sits alongside the codebase as a structured knowledge layer for the messaging platform.
- Organizes content by domains: "Messaging Core", "Realtime & WebSockets", "Presence & Notifications", "Files & Media", "Security & Auth".

## Entry Structure
- Each entry: `title`, `date`, `tags`, `status` (draft/active/deprecated), `rationale`, and `implications`.
- Tags for quick retrieval: `channels`, `dm`, `threads`, `reactions`, `typing`, `presence`, `read-receipts`, `websocket`, `notifications`, `files`, `scaling`.

## Patterns for Use
- Decision Records (ADR-style) for major technical/product decisions (e.g., WebSocket reconnection strategy, push provider choice).
- Reference Specs for behaviors: e.g., "Typing Indicator Protocol" or "Read Receipt Rules".
- Guidelines for consistent client patterns in React: state management for real-time events, optimistic updates, error handling.

## Change Management
- New decisions appended, never silently overwritten; old ones marked deprecated with reasons.
- Cross-link entries: e.g., presence model links to notification triggers and WebSocket event schema.
