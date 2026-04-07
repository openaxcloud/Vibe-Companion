# Product Context – Memory Bank Chatbot

## Problem Statement
- Users interact with generic AI chatbots that **forget context**, cannot reliably remember user preferences, and cannot deeply use the user's own documents.
- Knowledge workers need a **personal, persistent AI workspace** that:
  - Remembers important details over time
  - Combines chat with **private document search**
  - Streams answers quickly while citing where knowledge came from.

## Target Users
- Knowledge workers, students, and solo professionals needing a personal assistant.
- Founders/PMs/engineers wanting a **private, long-term context** assistant for notes, specs, and docs.
- Researchers and writers managing large reading materials.

## UX Goals
- Feel like “**one continuous conversation**” across days/weeks.
- Make memory **visible and controllable** (inspectable Memory Bank).
- Frictionless document upload with clear status and searchable list.
- Fast, responsive chat with streaming and typing indicators.
- Clear source attribution for answers grounded in documents or memory.

## Key User Flows
1. **Onboarding & First Chat**
   - User signs up → brief tour explaining Memory Bank & privacy → lands in main chat.
2. **Conversational Use**
   - User asks a question → GPT-5 responds with streaming → relevant prior messages & memories are used.
3. **Memory Management**
   - System auto-detects a stable fact ("My timezone is CET") → proposes it as a memory → user accepts/edits.
   - User visits Memory Bank view → filters by type (preference, profile, project) → edits or deletes items.
4. **Document Upload & RAG**
   - User uploads PDFs/docs → sees processing status (upload → chunk → embed → ready).
   - Later, user asks a question → relevant chunks are retrieved → GPT-5 answer includes citations and links to passages.
5. **Session Continuation**
   - User returns next day → continues in same chat or starts new thread → assistant recalls prior preferences & ongoing tasks.
