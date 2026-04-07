# Active Context – Current Focus & Next Steps

## Current Focus: Initial Setup & Memory Bank Foundations
- Establish project structure (frontend + backend workspaces, shared types).
- Implement minimal **chat → backend → GPT-5 → streaming** pipeline.
- Design data models for **Memory Bank** (conversations, memory entries, documents, chunks).

## Immediate Next Steps (Checklist)
- [ ] Initialize repo with TypeScript, linting, formatting, and basic CI.
- [ ] Scaffold React app with chat UI (static message list + input box).
- [ ] Implement backend `POST /chat/stream` endpoint calling GPT-5 with streaming.
- [ ] Decide on vector store (pgvector vs external) and provision local instance.
- [ ] Define DB schema for users, conversations, messages, memory_entries, documents, doc_chunks.
- [ ] Implement document upload endpoint + basic text extraction + chunking.
- [ ] Wire embeddings pipeline and store vectors for doc_chunks and memory_entries.
- [ ] Implement retrieval strategy (top-k semantic + recency weighting) for RAG context.
- [ ] Add post-reply hook to summarize and persist long-term memory entries.
- [ ] Add minimal UI for viewing/clearing conversation memory and uploaded documents.
- [ ] Add configuration for system prompt/persona stored per user.
- [ ] Add logging and basic error boundaries in frontend for failed streams/uploads.