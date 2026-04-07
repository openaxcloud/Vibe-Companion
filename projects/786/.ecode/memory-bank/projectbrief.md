# Project Brief: Memory Bank Chatbot

## Overview
- Build an intelligent web-based AI chatbot with OpenAI GPT-5 integration using TypeScript + React.
- Core differentiator: a "Memory Bank" that persists conversation context and user knowledge over time.
- Enable document upload and retrieval-augmented generation (RAG) so the bot can answer from a private knowledge base.
- Support low-latency streaming responses for a natural, chat-like UX.

## Core Requirements
- Secure user authentication and per-user Memory Bank (conversations + documents).
- GPT-5 powered chat endpoint with configurable system persona and tools.
- Short-term memory: message window per conversation.
- Long-term memory: summarized, searchable memory records per user.
- Document upload (PDF, TXT, MD, DOCX) with text extraction and chunking.
- Vector search (RAG) over both documents and long-term memories.
- Token-efficient context assembly (recent chat + relevant memories + RAG docs).
- Streaming responses from backend to React client.

## Goals & Success Criteria
- Provide precise, context-aware answers grounded in user history and documents.
- Keep latency low and UX responsive under typical SaaS workloads.
- Abstract Memory Bank as a reusable domain layer for future apps.
- Ship an MVP that is production-ready: observability, error handling, and basic security.

## Scope (MVP)
- Web app with login, chat interface, memory view, and document library.
- Single workspace per user, multi-conversation support.
- Admin configuration for OpenAI keys, model defaults, and memory limits.
- No mobile app or offline mode in the initial release.
