# Product Context: Memory Bank Chatbot

## Problem Statement
- Users repeatedly explain the same context to AI chatbots, and existing tools forget over time.
- Knowledge locked in personal documents is hard to leverage in day-to-day AI-assisted workflows.
- Teams want a secure, private RAG assistant that understands both long-term context and uploaded content.

## Target Users
- Individual knowledge workers (consultants, developers, researchers, writers).
- Small teams that need a shared assistant grounded in team documents.
- Power users of existing LLM tools who want persistent, controllable memory.

## UX Goals
- Feel like a personal assistant that "remembers" you across sessions.
- Transparent memory: users can see, edit, and delete saved memories and documents.
- Fast feedback loop: streaming responses with visible grounding sources.
- Safe defaults: easy to understand what is stored and how it is used.

## Key User Flows
1. **Onboarding & Profile**
   - Sign up / log in → accept data & privacy notice → set basic profile & preferences.
2. **Chatting with Memory**
   - Start a conversation → send messages → receive streaming replies that leverage short-term context.
   - Memory Bank auto-summarizes and stores key facts/events after the exchange.
3. **Document Upload & RAG**
   - Upload files → see processing status → view extracted content & metadata.
   - Ask questions; chatbot cites relevant document passages.
4. **Memory Management**
   - Open Memory Bank view → inspect long-term memories & vectors → edit or delete items.
   - Pin important memories to prioritize them in future chats.
5. **Configuration**
   - Manage API keys (admin) → configure GPT-5 model, temperature, and memory limits.
