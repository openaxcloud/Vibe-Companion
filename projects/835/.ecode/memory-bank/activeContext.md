# Active Context – Current Focus & Next Steps

## Current Focus
- Define and scaffold a **Memory Bank–centric AI chatbot** with GPT-5, RAG, and streaming.
- Establish a clear separation between **conversation history**, **long-term memory**, and **document knowledge base**.
- Prioritize a minimal but robust architecture that is easy to evolve.

## Next Steps Checklist (Initial Setup)
- [ ] Initialize repo structure (frontend + backend, shared types if mono-repo).
- [ ] Configure TypeScript, linting, formatting, and basic CI.
- [ ] Implement auth skeleton (sign up/in, protected routes, user table).
- [ ] Implement chat UI with:
  - [ ] Message list & composer
  - [ ] Streaming response handling via SSE/WebSocket
- [ ] Stand up backend chat endpoint that proxies to GPT-5 without RAG/memory.
- [ ] Add database schema for users, sessions, messages, memories, documents.
- [ ] Implement basic Memory Bank API (CRUD) and integrate display in UI.
- [ ] Implement document upload endpoint and UI, storing raw files.
- [ ] Integrate vector DB and implement ingestion pipeline (chunk + embed + index).
- [ ] Extend chat flow to include RAG retrieval + selected memories in GPT-5 prompts.
- [ ] Add memory extraction worker to propose new memories from conversations.
- [ ] Add observability: structured logging and basic metrics for request/model usage.
