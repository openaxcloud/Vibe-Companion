# Active Context – Current Focus & Next Steps

## Current Focus: Initial Setup for Memory Bank System
- Establish **project structure** (frontend + backend) with TypeScript.
- Implement **minimal chat flow** using GPT-5 with streaming responses.
- Design initial **Memory Bank domain model** (entities, relations, tables).
- Wire up a **vector store** and document ingestion pipeline (MVP).

## Next Steps Checklist
- [ ] Initialize repo with monorepo or single full-stack project (e.g., Next.js).
- [ ] Configure TypeScript, linting (ESLint), formatting (Prettier), and basic CI.
- [ ] Implement a simple chat UI with message list and input box.
- [ ] Add streaming GPT-5 endpoint and hook up frontend streaming rendering.
- [ ] Define DB schema: `User`, `ChatSession`, `Message`, `Memory`, `Document`, `DocumentChunk`.
- [ ] Integrate Postgres + Prisma; run initial migrations.
- [ ] Connect to vector store (pgvector or external) and create embeddings index.
- [ ] Implement document upload API, chunking, embedding, and storage.
- [ ] Implement retrieval logic for RAG (top-k document chunks + relevant memories).
- [ ] Implement Memory Bank UI panel to view and manage stored memories.
- [ ] Add telemetry/logging around LLM calls and retrieval steps.
- [ ] Prepare seed/test data and write initial integration tests for the chat pipeline.
