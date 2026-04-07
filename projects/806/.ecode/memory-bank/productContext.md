# Product Context — Memory Bank: Counter App

## Problem Statement
- Developers often need an example of how to persist simple state along with human-readable reasoning.
- Typical counter demos show numeric changes but not *why* a change was made or how past states can be revisited.
- This project provides a small, concrete example of a **Memory Bank**: a place where app state and human explanations are stored together.

## Target Users
- Developers learning React + TypeScript patterns for state and persistence.
- Architects or ML engineers wanting a minimal example of a memory abstraction.
- QA/PMs needing a simple, transparent demo of state history.

## UX Goals
- Make current counter state and its history immediately understandable.
- Require minimal clicks to:
  - Change the counter.
  - Save the current state into Memory Bank with an optional note.
  - Inspect and restore prior states.
- Keep layout uncluttered: one main action area, one history area.

## Key User Flows
1. **Basic Counting**
   - User opens app → sees current value (default 0).
   - User presses `+` or `-` → value updates instantly.
   - User changes step (e.g., from 1 to 5) → future increments use new step.

2. **Saving to Memory Bank**
   - User adjusts counter → enters an optional note ("Reached daily goal").
   - User clicks `Save to Memory Bank` → a memory entry is created with timestamp, value, and note.

3. **Browsing and Restoring**
   - User opens Memory Bank panel → sees list of snapshots sorted by newest first.
   - User clicks a snapshot → details are shown.
   - User clicks `Restore` → counter returns to that value; optionally log a new memory explaining the restore.

4. **Reset Flow**
   - User clicks `Reset` → counter returns to default; can optionally save this as a special memory entry.
