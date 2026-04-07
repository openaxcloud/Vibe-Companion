# Project Brief: Memory Bank – Todo App

## Overview
- **Project Name:** Memory Bank – Simple Todo App
- **Goal:** Provide a lightweight interface to capture and manage short-lived tasks ("memories") with add and delete functionality.
- **Form Factor:** Single-page web application built with React and TypeScript.

## Core Requirements
- Display a list of todo items (memory entries) in chronological order (newest on top or bottom – to be decided).
- Allow users to **add** a new todo item with a short text label.
- Allow users to **delete** existing todo items individually.
- Persist todos in browser memory layer (in-memory state) for this initial version; optional localStorage extension later.

## Memory Bank Concept
- Treat each todo as a lightweight “memory shard” with an id, content, and createdAt timestamp.
- Keep the internal state as the "Memory Bank" that all UI components read from and write to.
- Support simple lifecycle operations: **store (add)** and **forget (delete)**.

## Scope (Initial Release)
- One main screen with input field and list of todos.
- No user accounts, no backend, no multi-device sync.
- Accessibility-conscious, keyboard-friendly interactions.

## Non-Goals (for now)
- Editing todos, due dates, priorities, or reminders.
- Tagging, search, or complex filtering.
- Offline sync beyond basic client-side state (no service workers).

## Success Criteria
- Adding and deleting tasks feels instant and intuitive.
- Codebase is small, strongly typed, and easy to extend.
- Architecture clearly isolates the "Memory Bank" state from presentation components.
