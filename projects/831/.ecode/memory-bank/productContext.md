# Product Context – Memory Bank Chatbot

## Problem Statement
- Users interact with chatbots that repeatedly “forget” prior context and cannot leverage their private documents.
- Knowledge workers need an assistant that **remembers** discussions and can **reason over their own files** reliably.

## Target Users
- Knowledge workers (consultants, analysts, PMs, engineers) who work with docs and recurring tasks.
- Students and researchers needing a persistent study/research assistant.
- Solo founders and small teams using the bot as an external brain.

## UX Goals
- Feel like a **persistent companion**: remembers preferences, projects, and past decisions.
- Make document-based answers feel natural: the user shouldn’t manage indices or “collections”.
- Keep the UI **minimal but powerful**: fast chat window, clear memory indicators, visible sources.
- Transparent: show when an answer is grounded in **Memory Bank** vs. general GPT-5 knowledge.

## Key User Flows
1. **Start a Conversation**
   - User visits app → sees chat UI → types question → receives streaming GPT-5 answer.
2. **Conversation Memory**
   - User continues chatting → system automatically uses recent turns + summarized history.
   - User can inspect and optionally clear memory for the current conversation.
3. **Upload Documents for RAG**
   - User uploads files → sees processing status → documents appear in "Knowledge" list.
   - Future queries are grounded in uploaded docs via citations/snippets.
4. **Manage Memory Bank**
   - User views stored memories (key insights, decisions, preferences) and document catalog.
   - User can delete documents, clear specific memories, or reset entire Memory Bank.
5. **Configure Assistant**
   - User sets persona (e.g., tutor, coding assistant), tone, and domains of focus.
   - Settings influence system prompts and retrieval strategy.