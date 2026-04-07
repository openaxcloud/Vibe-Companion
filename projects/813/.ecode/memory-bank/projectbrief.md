# Project Brief – Memory Bank: Calculator App

## Overview
- Build a **simple calculator web app** with a lightweight **Memory Bank** to persist recent calculations.
- Implemented as a **single-page app** using **React + TypeScript**.
- Target: quick, reliable arithmetic with a small, easily reviewable history.

## Core Requirements
- Support basic operations: **addition, subtraction, multiplication, division**.
- Input via on-screen buttons and keyboard where possible.
- Display **current expression** and **result** clearly.
- Memory Bank: keep the **last N (e.g., 10)** calculations (expression + result).
- Allow users to **re-use a past result** by clicking a memory entry.

## Goals
- Provide a **clean, minimal UI** focused on clarity and accuracy.
- Ensure **predictable calculator behavior** (operator precedence, clear, all-clear, etc.).
- Provide a **simple, inspectable Memory Bank** that is resistant to accidental loss (e.g., page refresh via local storage).

## Scope
- Web-only, responsive layout for desktop and mobile browsers.
- No advanced math (no trig, exponents, parentheses) in v1.
- No user accounts; memory is **per browser/device**.
- Scope limited to core arithmetic and memory/history functions.

## Out of Scope (v1)
- Scientific functions and complex expressions.
- Server-side persistence or multi-device sync.
- Accessibility beyond basic semantic HTML and keyboard support.
