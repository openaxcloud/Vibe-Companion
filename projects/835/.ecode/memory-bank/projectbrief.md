# Project Brief – Memory Bank Chatbot

## Overview
- Build a web-based intelligent AI chatbot with **OpenAI GPT-5** integration.
- Provide **persistent conversation memory** ("Memory Bank") across sessions.
- Support **document upload** to build a **RAG (Retrieval-Augmented Generation) knowledge base**.
- Deliver **streaming responses** for real-time conversational feel.
- Implement in **TypeScript + React** for the frontend; backend stack is flexible but should expose clear APIs.

## Core Requirements
- Secure user authentication (email/password or SSO-ready) and per-user memory isolation.
- Chat interface with:
  - Message history
  - Streaming assistant responses
  - Inline citation/traceback to uploaded documents when used.
- Memory Bank layer that:
  - Stores long-term user facts, preferences, and context
  - Surfaces relevant memory to GPT-5 for each request
  - Allows user to view/edit/delete memories.
- RAG pipeline:
  - Upload PDFs, text, and common office formats
  - Chunk, embed, and store in a vector DB
  - Retrieve top-k chunks per query and feed to GPT-5.

## Goals
- Provide a **personal, context-aware assistant** that gets smarter over time.
- Minimize token usage via smart memory summarization and retrieval.
- Create a modular architecture to easily swap models/providers and vector DB.
- Ensure privacy by clearly separating **ephemeral context**, **long-term memory**, and **document knowledge base**.

## Scope (v1)
- Single web app for authenticated users.
- One default GPT-5 assistant persona with configurable system prompt.
- Simple document library & basic metadata (title, type, uploaded-at).
- Memory Bank CRUD and automatic memory extraction from conversations.
- No multi-tenant organizations or advanced admin console in v1.
