# Memory Bank – Active Context & Next Steps

## Current Focus
- Initial setup of Memory Bank to support the new Slack-like messaging platform.
- Establish core domains and minimal seed documentation so future decisions have a clear home.

## Seed Topics to Create Now
- Messaging model: messages, channels (public/private), DMs, threads, reactions.
- Real-time layer: WebSocket connection lifecycle, reconnection, event formats.
- Presence & activity: presence states, typing indicators, read receipt rules.
- Notifications: in-app vs. push, throttling, per-user preferences.
- Files & images: upload limits, storage strategy, preview behavior, security.

## Next Steps Checklist
- [ ] Create `docs/memory-bank/` structure and domain subfolders.
- [ ] Add a "Memory Bank Usage Guide" explaining how and when to add entries.
- [ ] Write initial ADRs for: state management in React, WebSocket library/approach, and auth strategy.
- [ ] Document baseline message/presence/notification schemas.
- [ ] Integrate Memory Bank review into PR template and development workflow.
