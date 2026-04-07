# Active Context – Current Focus & Next Steps

## Current Focus
- Establish **baseline architecture** for Memory Bank chatbot:
  - React frontend shell with chat layout.
  - Node/TypeScript backend with simple chat → GPT-5 streaming.
  - Minimal data model for users, conversations, and messages.
- Implement a **thin Memory Bank** abstraction (in-memory or simple DB) to prove the pattern early.

## Next Steps Checklist
- [ ] Scaffold backend (Express/Fastify) with health/check and `/chat/stream` endpoint.
- [ ] Integrate OpenAI GPT-5 streaming API via official SDK.
- [ ] Implement SSE streaming pipeline from backend to frontend.
- [ ] Define initial DB schema: `users`, `conversations`, `messages`, `memories`, `documents`.
- [ ] Implement Memory Bank v0: store/retrieve short-term and basic long-term facts.
- [ ] Scaffold React app: chat view, message list, streaming rendering, stop-generation button.
- [ ] Add file upload endpoint + basic text extraction and storage (no embeddings yet).
- [ ] Integrate vector DB and embeddings; implement RAG retrieval into chat orchestrator.
- [ ] Expose Memory panel in UI to visualize / reset stored memories.
- [ ] Add logging and simple tracing of which memories and documents were used per response.
