# Product & UX Context – Memory Bank Calculator

## Problem Statement
Users need a **quick, reliable calculator** in the browser that preserves recent calculations and results during their session.
Traditional toy calculators often lose state or scatter logic in UI components, making them hard to extend.

## Target Users
- Developers testing numeric inputs or formulas.
- Students doing quick arithmetic.
- Casual users needing a lightweight web calculator tab.

## UX Goals
- **Zero learning curve**: should behave like a basic handheld calculator.
- **State transparency**: show current input, last operation, and recent results.
- **Low friction**: minimal clicks, clear buttons, responsive layout.

## Key User Flows
1. **Basic Calculation**
   - User enters numbers → chooses operation → enters next number → presses `=` → sees result stored in Memory Bank.
2. **Chained Operations**
   - After `=`, user continues with another operation using the **last result** as the new starting value.
3. **History Recall**
   - User sees a short list of recent expressions (e.g., `3 + 4 = 7`) pulled from Memory Bank.
4. **Clear / Reset**
   - User presses `C` to clear current input and optionally `AC` (if implemented) to reset the entire Memory Bank.
