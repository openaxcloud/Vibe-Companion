# Project Brief – Memory Bank Chatbot

## Overview
- Build a web-based AI chatbot with **OpenAI GPT-5** integration using **TypeScript + React**.
- Core feature: a **Memory Bank** that persists and reuses knowledge from conversations and uploaded documents.
- Support **RAG (Retrieval-Augmented Generation)** over user-uploaded documents and long-term conversation history.
- Provide **streaming responses** for fast, incremental UI updates.

## Core Requirements
- Secure **chat interface** with GPT-5 backend.
- **Short-term memory** within a session and **long-term memory** persisted across sessions.
- **Document upload** (PDF, TXT, possibly DOCX) to build/update a per-user knowledge base.
- **Semantic search** over Memory Bank + documents to ground model responses.
- **Configurable system instructions** (persona, tone, knowledge boundaries).
- **Rate limiting and safety** guardrails (token limits, max docs, file sizes).

## Goals
- Deliver a **responsive, trustworthy assistant** that “remembers” context.
- Optimize for **low-latency streaming** and efficient token usage via memory summarization.
- Provide a clean, extensible architecture for future features (multi-agent, teams, analytics).

## Scope (Initial Release)
- Web client only (desktop-first, mobile-friendly).
- Single user login model (or simple auth placeholder) with per-user Memory Bank.
- No enterprise features yet (RBAC, org sharing), but design for future multi-tenant expansion.
- Basic observability (logs, error tracking, minimal metrics).