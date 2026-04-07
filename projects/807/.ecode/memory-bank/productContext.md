# Product Context: Calculator App – Memory Bank

## Problem Statement
- Users need a quick, reliable way to perform everyday arithmetic from the browser.
- Existing tools may be cluttered, ad-heavy, or missing keyboard support.

## Target Users
- General users doing quick day-to-day calculations.
- Students needing a simple, distraction-free calculator.
- Developers/testers using a predictable calculator for quick checks.

## UX Goals
- **Clarity**: Large, legible display of input and result.
- **Simplicity**: Minimal controls—no unnecessary features in v1.
- **Responsiveness**: Works well on phones, tablets, and desktops.
- **Predictability**: Calculator behaves like a standard 4-function handheld calculator.

## Key User Flows
1. **Basic Calculation**
   - Open app → Press number keys → Choose operation → Press next number → Press `=` → See result.
2. **Chained Operations**
   - Enter `2 + 3 + 4 =` → See `9` with correct running total.
3. **Clear / Reset**
   - Mid-calculation, press `C` or `AC` → Reset current input and/or full state.
4. **Error Handling**
   - Attempt `number ÷ 0` → Show an error message or special result indicator → Allow user to clear and continue.
5. **Keyboard Input (if implemented)**
   - Type `1`, `+`, `2`, `Enter` → Same result as clicking the buttons.

## Non-Functional Experience Goals
- Very fast interactions; no visible lag between input and display.
- No onboarding needed; users understand functionality instantly.
- Accessible labels and focus states for screen readers and keyboard navigation.
