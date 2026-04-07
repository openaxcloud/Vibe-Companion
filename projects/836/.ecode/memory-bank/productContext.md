# Product Context – Memory Bank Chatbot

## Problem Statement
- Users need an AI assistant that **remembers prior conversations** and **understands their documents**, not a stateless chatbot.
- Existing tools often forget context quickly, cannot ingest custom docs easily, or feel slow and opaque.

## Target Users
- Knowledge workers (consultants, PMs, researchers) who chat with AI daily.
- Startup teams who want a **knowledgeable internal assistant** over their docs.
- Developers evaluating OpenAI GPT-5 and RAG patterns with a real-world reference app.

## UX Goals
- Chat interface that feels like messaging with a smart colleague.
- Clear mental model of **"what the AI remembers"**:
  - Visual Memory Bank panel (session memory, long-term notes, documents).
  - Ability to pin/unpin facts from a conversation into long-term memory.
- Smooth **document upload** with status, errors, and searchability.
- **Streaming responses** with typing indicator and partial rendering.

## Key User Flows
1. **Conversational Q&A**
   - User opens app → starts chatting → GPT-5 responds with streaming.
   - Context from previous turns is automatically used.
2. **Memory Management**
   - User marks a message as "Remember this" → stored as long-term memory.
   - User views, edits, or deletes saved memories.
3. **Document Upload for RAG**
   - User uploads a document → system ingests & indexes chunks.
   - User queries → system retrieves top-k relevant chunks → GPT-5 answers citing docs.
4. **Context Inspection**
   - User opens Memory Bank to see which memories/docs influenced the last answer.
