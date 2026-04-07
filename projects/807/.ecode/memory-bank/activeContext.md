# Active Context: Calculator App – Memory Bank

## Current Focus
- Set up a minimal but well-structured React + TypeScript project.
- Implement the core calculator logic and connect it to a basic UI.
## Immediate Next Steps (Checklist)
- [ ] Initialize project with Vite (or CRA) using TypeScript template.
- [ ] Configure `tsconfig.json` with strict type settings.
- [ ] Scaffold base structure: `App`, `features/calculator` directory.
- [ ] Implement pure calculation logic (`calculatorLogic.ts`) with unit tests.
- [ ] Create `useCalculator` hook to wrap state transitions and actions.
- [ ] Implement `Calculator`, `Display`, and `Keypad` components.
- [ ] Wire button clicks to `useCalculator` actions (digits, operators, equals, clear).
- [ ] Add basic styles for readable, responsive layout.
- [ ] Add keyboard input handling (if in scope for v1).
- [ ] Run tests + manual QA for standard and edge-case operations.
## Near-Term Enhancements (After Core is Stable)
- [ ] Improve accessibility (ARIA attributes, focus management, high contrast).
- [ ] Add simple result history or last-result recall.
- [ ] Polish styles and consider light/dark theme toggle.