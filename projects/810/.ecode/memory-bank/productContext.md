# Product Context: Memory Bank – Simple Todo App

## Problem Statement
People need a lightweight way to offload small tasks from their mind into a simple, always-available "memory bank" so they can focus on work without cognitive overload.

## Target Users
- Knowledge workers needing a quick scratchpad for tasks
- Students tracking assignments and study todos
- Anyone who wants a frictionless, no-signup task list in the browser

## UX Goals
- Near-zero friction to add a task: type and press Enter
- Clear visual separation of active vs completed items
- Minimal chrome: focus on the list, not the app
- Undo-friendly: easy to toggle completion or delete mistakes
- Consistent behavior across reloads via local storage

## Key User Flows
1. **Capture Todo**
   - User opens Memory Bank → types task in input → presses Enter → task appears at top of list.
2. **Complete Todo**
   - User clicks checkbox on a todo → item visually dims/strikes through → status saved to local storage.
3. **Edit Todo**
   - User clicks on todo text or edit icon → inline edit field shown → user updates text → presses Enter or clicks save.
4. **Filter Todos**
   - User selects All / Active / Completed → list updates accordingly without page reload.
5. **Clear Completed**
   - User clicks "Clear completed" → confirmation (optional for MVP) → all completed todos removed.
6. **Persistent Memory**
   - User closes tab/browser → reopens later → todos restored from local storage.

## Success Criteria (MVP)
- New users can add and complete a todo in <10 seconds without instructions.
- Todos survive a hard refresh and browser restart.
- UI remains usable on a phone-sized viewport.