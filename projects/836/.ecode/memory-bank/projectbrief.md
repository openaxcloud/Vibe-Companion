# Project Brief – Memory Bank Chatbot

## Overview
- Build a web-based **intelligent AI chatbot** using **React + TypeScript** that integrates **OpenAI GPT-5**.
- Core differentiator: a **Memory Bank** that persists conversation state and user-specific knowledge over time.
- Support **document upload** (PDF, DOCX, TXT, etc.) and use them as a **RAG knowledge base** for more accurate answers.
- Provide **streaming responses** for low-latency, conversational feel.

## Core Requirements
- Secure, typed **frontend** in React (TS) with chat-style UI and memory controls.
- Backend (Node/Edge) that manages:
  - GPT-5 completion & embedding calls.
  - User/session-based **long-term and short-term memory**.
  - Document ingestion, chunking, embedding, and retrieval.
- Memory Bank abstractions:
  - **Ephemeral memory** (within single session).
  - **Persistent memory** (per user, across sessions).
  - **Knowledge memory** (uploaded docs + derived facts).

## Goals
- Deliver **relevant, personalized** responses that improve as the system learns.
- Keep architecture modular so memory, vector store, and model provider can be swapped.
- Optimize for **low latency**, **observability**, and **data privacy**.

## Scope
- In-scope: core chat UI, memory models, RAG pipeline, auth-lite (per-session or simple user accounts), logging.
- Out-of-scope (initially): complex multi-user collaboration, workflow orchestration, fine-tuning models, enterprise admin dashboards.
