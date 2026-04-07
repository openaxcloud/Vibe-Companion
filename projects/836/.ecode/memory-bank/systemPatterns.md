# System & Patterns – Memory Bank Architecture

## High-Level Architecture
- **Frontend (React + TS)** → calls **Backend API** via HTTPS.
- **Backend** (Node/TypeScript, e.g., Next.js API routes or Express) handles:
  - GPT-5 chat completions (streaming via SSE/Fetch streaming).
  - Embeddings for documents and memories.
  - Vector store operations for RAG.
  - Memory Bank CRUD and retrieval.
- **Data stores**:
  - Vector DB (e.g., pgvector, Pinecone, Qdrant) for embeddings.
  - Primary DB (Postgres/Prisma or SQLite) for users, sessions, messages, and memory metadata.
  - Object storage (S3-compatible) for original uploaded files (optional).

## Memory Bank Design Patterns
- **Layered Memory Pattern**:
  - Short-term: recent messages in current session.
  - Long-term: selected user memories summarized & embedded.
  - Knowledge: document chunks + derived notes.
- **Retriever-Composer Pattern**:
  - Orchestrator builds a prompt from layered memory + current query.
  - Uses rank-and-filter logic (e.g., recency, relevance score, memory type).
- **Summarization Pipeline**:
  - Periodically summarize long threads into compact memory notes.

## Key Technical Decisions
- Use **server-driven conversation state**; client only mirrors state.
- Abstract model provider via an interface: `LLMClient` (supports GPT-5, easy swap).
- Use **streaming endpoints** that return chunks of text/JSON deltas.
- Adopt **Clean Architecture** boundaries:
  - `domain` (Memory entities, ChatSession, DocumentChunk).
  - `application` (use-cases: `GenerateReply`, `StoreMemory`, `IngestDocument`).
  - `infrastructure` (OpenAI client, DB, vector store adapters).

## Cross-Cutting Concerns
- **Observability**: structured logs around each LLM call, token usage, latency.
- **Safety**: system & user instructions to constrain GPT-5; optional content filters.
- **Privacy**: clear separation of user data by ID; encryption at rest and in transit.
