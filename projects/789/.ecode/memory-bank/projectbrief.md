# Project Brief – Memory Bank: Simple Calculator

## Overview
This project implements a **Memory Bank** system around a simple calculator built with **TypeScript + React**.
The Memory Bank captures and manages calculation-related state so that the UI remains thin and declarative.

## Core Requirements
- Implement a basic calculator UI with operations: **add, subtract, multiply, divide**.
- Use a **centralized Memory Bank** to store:
  - Current input and pending operation.
  - Last result and error state (e.g., divide by zero).
  - A small, ordered **history of calculations**.
- Provide basic memory actions (e.g., clear all, recall last result).

## Goals
- Separate **business logic (Memory Bank)** from **presentation (React components)**.
- Make the calculator logic **testable, deterministic, and reusable**.
- Keep the app small but structured to scale (new operations, advanced memory features).

## Scope
- Single-page React app with:
  - Display for current value and last operation.
  - Numeric and operation buttons (+, -, ×, ÷, =, C).
  - A small panel for recent calculations.
- No authentication, persistence, or backend; Memory Bank lives in browser memory.
- Designed so the Memory Bank can later be extracted into a shared library.
