# Project Brief – Memory Bank: Simple Counter

## Overview
This project implements a **Memory Bank counter**: a simple numerical counter with plus and minus buttons, and the ability to remember key values ("memory slots"). It is built as a small React + TypeScript single-page application.

## Core Requirements
- Display the **current counter value** (integer).
- Provide **+ (increment)** and **– (decrement)** buttons.
- Provide **Memory Bank controls**:
  - **Save to memory**: store the current counter value in a list of saved entries.
  - **List memories**: display all saved values in a chronological list.
  - **Recall from memory**: allow setting the counter to a selected saved value.
  - **Clear memory**: remove all saved values.

## Goals
- Demonstrate a clean, testable architecture for a very small React app.
- Make core logic (counter & memory operations) reusable and framework-agnostic.
- Ensure the UI is intuitive and responsive with minimal styling.

## Scope
- Single view web app (no routing).
- Simple, in-memory persistence (no backend); optional localStorage integration.
- No authentication or user accounts.
- Target desktop and mobile web browsers with a basic responsive layout.
