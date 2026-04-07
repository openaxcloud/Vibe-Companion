# System Patterns – Architecture & Design

## High-Level Architecture
- **Client (React + TypeScript)**
  - Chat UI with streaming via SSE or WebSocket.
  - Memory Bank manager (view/edit memories, toggle auto-memory).
  - Document upload & library views.
- **Backend API** (e.g., Node/Express/Nest/Fastify, not mandated here)
  - Auth & user/session management.
  - Chat orchestration endpoint (RAG + Memory Bank + GPT-5 call).
  - Memory extraction, storage, and retrieval services.
  - Document ingestion pipeline and vector search API.
- **Data Stores**
  - Relational DB for users, chats, memories, document metadata.
  - Vector DB for embeddings (documents + memory embeddings if needed).

## Key Technical Decisions
- Use an **orchestrator pattern** on the backend: one service coordinates memory retrieval, RAG, and GPT-5 prompts.
- Represent memory as typed entities (profile, preference, project, fact) to enable selective retrieval.
- Use **hybrid context building**: recent messages + selected memories + retrieved docs.
- Implement **token budget management**: truncation, summarization of long histories, and prioritized context.

## Design Patterns
- **Repository pattern** for DB and vector DB access (swap implementations easily).
- **Adapter pattern** for model provider (OpenAI GPT-5 behind a model adapter interface).
- **Pipeline pattern** for the RAG flow:
  - Ingest → Chunk → Embed → Index → Retrieve → Rank → Prompt.
- **Observer / Event pattern** for memory extraction:
  - Conversation events (message_saved) trigger memory candidate extraction jobs.
- **State management pattern** on frontend:
  - Global store (e.g., Zustand/Redux) for sessions, messages, upload state.
  - Local component state for UI controls.

## Streaming Strategy
- Backend opens SSE/WebSocket stream for GPT-5 tokens.
- Frontend incrementally appends tokens, updates scroll, and handles cancellation.
