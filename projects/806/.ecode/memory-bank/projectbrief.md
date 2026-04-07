# Project Brief — Memory Bank: Counter App

## Overview
- **Project Name:** Memory Bank — Simple Counter App
- **Goal:** Build a small React + TypeScript app that counts up/down and persists its value to a Memory Bank (a structured store for app state and reasoning notes).
- **Core Idea:** Treat each counter change and related explanation as a "memory" that can be stored, inspected, and restored.

## Core Requirements
- Display a numeric counter with:
  - Increment, decrement, and reset controls.
  - Configurable step value (e.g., +1, +5).
- Integrate a **Memory Bank module** that can:
  - Save the current counter value as a memory snapshot.
  - Store optional text notes explaining why the value changed.
  - List previously saved snapshots.
  - Restore the counter value from a selected snapshot.
- Maintain type-safe models for counter state and memory entries.

## Goals
- Demonstrate how a simple UI can interact with a Memory Bank abstraction.
- Provide a clean, testable architecture separating UI, state management, and persistence.
- Keep implementation small and readable while being production-structure ready.

## Scope
- In-scope:
  - Single-page React app.
  - Local-only Memory Bank (in-memory plus optional `localStorage`).
  - Simple, accessible UI with basic styling.
- Out-of-scope (for now):
  - Authentication and multi-user support.
  - Server-side storage or synchronization.
  - Advanced analytics or visualizations of memory history.
