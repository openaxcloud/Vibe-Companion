# Product & UX Context – Memory Bank Chatbot

## Problem Statement
- Users struggle to get **consistent, personalized** help from generic chatbots.
- They need an assistant that **remembers prior interactions** and can reason over their **own documents** without constantly re-uploading or re-explaining.

## Target Users
- Knowledge workers (engineers, analysts, writers) wanting a persistent research / coding assistant.
- Small teams using an AI assistant as a **knowledge companion** for docs, specs, and notes.
- Power users experimenting with **personal AI memory**.

## UX Goals
- Feel like talking to a **continuous, remembering assistant**, not a stateless bot.
- Make **memory visibility** clear: what the system knows, where it came from, and how to reset it.
- Document upload must be **frictionless** and clearly reflected in responses (citations/snippets).
- Streaming answers must be **responsive and cancellable**.

## Key User Flows
1. **Start a New Conversation**
   - User opens app → clicks "New Chat" → types question → sees streamed GPT-5 answer.
   - System stores conversation turns in short-term memory.
2. **Personalization via Memory Bank**
   - User describes preferences (e.g., "Explain things concisely with code examples").
   - Memory Bank stores these as persistent profile facts → future answers adapt style.
3. **Document Upload & RAG**
   - User uploads PDF(s) → sees them in a "Knowledge" panel.
   - App processes files (chunk + embed) and enables queries like "Summarize section 3".
   - Responses include inline references to document titles/sections.
4. **Conversation Continuation**
   - User returns later → opens previous chat from sidebar.
   - Chat resumes with condensed summary in system prompt + relevant memories.
5. **Memory Management**
   - User opens Memory panel → views stored facts & doc list.
   - Can pin/unpin memories, delete specific facts, or clear all.
