# Active Context & Next Steps

## Current Focus: Initial Setup & Memory Bank Foundations
- Establish project structure for React frontend and Node/TypeScript backend.
- Define core domain models: User, Conversation, Message, MemoryRecord, Document, Chunk.
- Implement basic auth and a minimal chat flow wired to GPT-5 with streaming.
- Lay groundwork for Memory Bank (DB schema + service interfaces) before full RAG.

## Immediate Checklist
- [ ] Scaffold backend (Express/Fastify) with health check and versioned API routes.
- [ ] Set up Postgres with migrations and pgvector; define core tables.
- [ ] Implement `/chat/stream` endpoint that proxies GPT-5 with SSE or chunked HTTP.
- [ ] Scaffold React app with chat UI, message list, input box, streaming display.
- [ ] Integrate OpenAI client with typed wrappers, error handling, and logging.
- [ ] Define Memory Bank service interfaces (saveMemory, retrieveMemories, pruneMemory).
- [ ] Add simple short-term memory windowing in chat orchestration.
- [ ] Add basic document upload endpoint and S3 integration (no RAG yet).
- [ ] Configure `.env` and local dev scripts (db migration, seed, start).
- [ ] Add minimal observability: request logging, error boundary, simple metrics hooks.
