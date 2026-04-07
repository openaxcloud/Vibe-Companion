# Product Context: Memory Bank – Todo App

## Problem Statement
People need a simple, distraction-free place to capture and manage small tasks. Existing apps can feel bloated, complex, or tightly coupled to accounts and sync, which is overkill for quick personal task tracking in the browser.

## Target Users
- Individuals wanting a lightweight personal todo list on desktop or mobile web
- Developers and early adopters who may later expand Memory Bank as a personal knowledge system

## UX Goals
- Zero-friction task capture (add todo with minimal fields and clicks)
- Clear visibility of what needs to be done today vs. completed items
- Subtle affordances; minimal visual noise
- Keyboard-friendly interactions (e.g., Enter to add, Esc to cancel)

## Key User Flows
1. **Add a task**
   - User types a title in the input and presses Enter
   - Task appears at the top of the list in `pending` state
2. **Mark task as done/undone**
   - User toggles a checkbox to mark the task complete or revert to pending
3. **Edit task**
   - User clicks on a task to edit its title/description inline
4. **Delete task**
   - User clicks a delete icon to remove the task
5. **Filter tasks**
   - User switches between All / Active / Completed filters
