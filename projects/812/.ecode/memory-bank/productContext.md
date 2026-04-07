# Product Context

## Problem Statement
- Users need a straightforward way to capture and track small tasks without the overhead of complex productivity tools.
- Existing solutions may feel too heavy for quick personal task management.

## Target Users
- Individual users managing personal todos (students, professionals, home users).
- Users working on a single device (browser) without account sync requirements.

## UX Goals
- Zero learning curve: user should understand the app in seconds.
- Fast capture: adding a task requires minimal inputs and interactions.
- Clear visual distinction between active and completed tasks.
- Non-destructive interactions: easy to undo mistakes via edit instead of complex versioning.

## Key User Flows
1. **Create Task**
   - User types a title (and optional description) into an input and submits.
   - Task appears at the top of the list with a default "pending" status.
2. **Complete / Reopen Task**
   - User clicks a checkbox or toggle to mark a task as completed.
   - Completed tasks show reduced emphasis (e.g., muted text, strikethrough).
3. **Edit Task**
   - User selects an existing task, updates title/description, and saves.
4. **Delete Task**
   - User removes an unwanted task from the list.
5. **Filter Tasks**
   - User switches between All / Active / Completed views while the URL stays simple (no routing required initially).
