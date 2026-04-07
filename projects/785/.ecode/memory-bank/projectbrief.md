# Project Brief – Memory Bank Chatbot

## Overview
- Build a **TypeScript + React** web app: an intelligent AI chatbot with persistent **Memory Bank** for user conversations and uploaded documents.
- Core engine: **OpenAI GPT-5** (via API) with **streaming responses**, **conversation memory**, and **RAG (Retrieval-Augmented Generation)** over a user-specific knowledge base.

## Core Requirements
- **Chat interface** with:
  - Real-time **streamed tokens** (typewriter effect).
  - Message roles (user/assistant/system) and timestamps.
- **Memory Bank** layer:
  - Short-term memory: current conversation context window.
  - Long-term memory: persisted summaries, user profile, and key facts.
  - Per-user isolation of memories.
- **Document upload for RAG**:
  - Support common file types (PDF, TXT, MD, DOCX as stretch).
  - Chunking + embedding + vector storage.
  - Retrieval pipeline feeding GPT-5 with top-k relevant chunks.
- **Session management**:
  - Named conversations, history listing, resume & delete.

## Goals
- Provide **contextually rich, personalized** responses using stored memory and user documents.
- Maintain a clean, extensible **Memory Bank abstraction** decoupled from UI and LLM provider.
- Ensure **observability and debuggability** of memory and RAG behavior (inspect what context was used).

## Scope (Initial Release)
- Single-page React app with:
  - Chat window, input box, streaming output.
  - Sidebar for conversation list and memory/debug panel.
  - Document upload & library view.
- Backend (can be separate service) to:
  - Manage users/sessions, memory, embeddings, file storage.
  - Call OpenAI GPT-5 (chat completion with streaming).

## Out of Scope (Initial)
- Multi-tenant auth beyond basic user identity stub.
- Real-time collaboration between users.
- Complex access controls and team-level shared knowledge bases.
