# System Architecture & Patterns – Memory Bank

## High-Level Architecture
- **Client (React + TypeScript)**
  - Chat UI, document upload, memory viewer, streaming display.
  - Talks to backend via REST/JSON + Server-Sent Events (SSE) or WebSocket for streaming.
- **Backend API (TypeScript/Node)**
  - Routes: chat, memory, documents, embeddings.
  - Integrates with **OpenAI GPT-5** and **vector store**.

## Core Components
- **Memory Bank Service**
  - Interfaces: `ShortTermMemory`, `LongTermMemory`, `DocumentMemory`.
  - Responsibilities: select memories, manage decay/summarization, persist per-user state.
- **RAG Pipeline**
  - Document ingestion → text extraction → chunking → embedding → vector storage.
  - Query-time retrieval → relevance ranking → context assembly.
- **Chat Orchestrator**
  - For each user query: gather conversation context + Memory Bank + RAG chunks → build system & tool prompts → call GPT-5 streaming → persist results.

## Key Technical Decisions
- **Streaming**: SSE preferred for simplicity; WebSocket optional later.
- **Vector storage**: start with hosted solution (e.g., Pinecone / pgvector) behind `VectorStore` interface.
- **Prompting strategy**:
  - System prompt: role, instructions, safety.
  - Memory prompt: user profile + distilled long-term facts.
  - RAG prompt: top-k chunks with citations.
- **Summarization pattern**:
  - Periodically summarize long conversations into compact memory entries.

## Design Patterns
- **Ports & Adapters (Hexagonal)** for OpenAI client, vector store, and storage.
- **Repository pattern** for conversations, messages, memories, and documents.
- **Strategy pattern** for chunking, retrieval ranking, and memory selection.
- **Command pattern** for chat actions (start chat, send message, regenerate, stop stream).
- **Observer/Emitter** on backend for streaming events; client subscribes and updates UI incrementally.
