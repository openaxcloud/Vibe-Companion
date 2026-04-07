# System Patterns & Architecture

## High-Level Architecture
- **Client**: React (TypeScript) SPA for chat, document management, memory views.
- **Backend API**: Node/TypeScript (e.g., Express/Fastify) as a thin orchestration layer.
- **AI Orchestration**: Service for GPT-5 calls, RAG pipeline, and Memory Bank logic.
- **Data Stores**:
  - Primary DB (Postgres) for users, conversations, messages, documents, memory metadata.
  - Vector store (e.g., PostgreSQL pgvector / external service) for embeddings.
  - Object storage (S3-compatible) for raw document files.

## Key Design Patterns
- **Hexagonal / Ports & Adapters**
  - Domain services for ChatSession, MemoryBank, DocumentLibrary.
  - Adapters for OpenAI, storage, and vector DB.
- **CQRS-lite**
  - Read-optimized endpoints for chat history, memories, and search.
  - Write endpoints for chat messages, memory updates, and uploads.
- **Pipeline Pattern for RAG**
  - Steps: preprocess → embed → store → retrieve → rank → context-assemble → generate.
- **Event-Driven Memory Updates**
  - Conversation-ended / message-batch events trigger summarization + memory writes.
- **Streaming Pattern**
  - Server-Sent Events or HTTP chunked responses from backend to React for token streaming.

## Memory Bank Logic
- Short-term memory: sliding window selector + recency-based pruning.
- Long-term memory: periodic summarization of spans into structured memory records.
- Retrieval: hybrid search (semantic vectors + keyword) over memories + documents.
- Safety: per-user isolation, hard caps on memory size and context tokens.
