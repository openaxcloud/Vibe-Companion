# Memory Bank – Tech Context

## Storage & Organization
- Stored as markdown/JSON files in a `docs/memory-bank` or similar directory in the messaging platform repo.
- Structured folders per domain: `messaging-core/`, `realtime/`, `presence-notifications/`, `files-media/`, `security-auth/`, `ux-behavior/`.

## Relation to App Tech Stack
- Mirrors the main stack (TypeScript + React) by capturing:
  - Shared type contracts for messages, channels, users, presence, and notifications.
  - WebSocket event shapes and client handling patterns.
  - Integration points for service workers / push notifications.

## Access & Tooling
- Maintained in Git, reviewed via PR like code.
- Optional tooling: simple search indexing (e.g., static site generator or doc search) to quickly find entries by tags.

## Environment & Conventions
- No runtime env vars; Memory Bank is static documentation.
- Naming convention: `YYYY-MM-DD-topic-short-title.md` for decisions and specs.
- All new features (e.g., message threading, reactions) must add or update at least one Memory Bank entry.
