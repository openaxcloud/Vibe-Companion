# System Patterns – Architecture & Design

## High-Level Architecture
- **Client (React + TypeScript)** → **Backend API (Node/Express or Nest)** → **OpenAI GPT-5 API**.
- **Memory Bank Layer**: Long-term conversation memory + document embeddings store.
- **RAG Pipeline**: query → vector search → context assembly → GPT-5 completion (streamed to client).

## Key Components
- `ChatUI`: message list, input box, streaming renderer, source citations.
- `MemoryService`: manages short-term context window and long-term summarized memory.
- `DocumentService`: upload, parse, chunk, embed, and index documents.
- `RetrievalService`: hybrid retrieval (semantic + optional keyword) over memories + docs.
- `SessionManager`: handles per-user/per-thread IDs and context boundaries.

## Design Patterns
- **Backend Facade** over OpenAI: a single `OpenAIClient` abstracts GPT-5 calls and model configs.
- **CQRS-style separation**: commands (upload doc, store memory) vs queries (retrieve context, chat).
- **Event-driven memory updates**: after each assistant reply, emit event to summarize and store key memory.
- **Repository pattern** for Memory Bank and document stores (swap in Postgres, Mongo, or hosted vector DB).
- **Strategy pattern** for retrieval: pluggable retrieval strategies (documents only, memory only, hybrid).

## Memory Model
- **Short-term**: last N turns of conversation, directly sent to GPT-5.
- **Long-term**: periodically summarized into higher-level “memory entries” with embeddings.
- **Document knowledge**: separate collection; retrieval merges with long-term conversational memory.

## Streaming & Performance
- Use **Server-Sent Events (SSE)** or **websockets** from backend to client for token streaming.
- Use **token budgeting**: trim context based on recency, relevance score, and summary length.
- Batch embeddings where possible to minimize round trips to OpenAI embedding endpoints.