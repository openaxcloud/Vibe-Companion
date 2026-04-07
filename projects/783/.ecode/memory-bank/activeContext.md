# Active Context – Initial Setup & Next Steps

## Current Focus
- Define Memory Bank–aware data model for users, channels, messages, and memory artifacts.
- Scaffold TypeScript React app with routing and basic layout (sidebar + channel/DM view).
- Establish WebSocket and REST API contracts for messaging, channels, and typing indicators.

## Next Steps Checklist
- [ ] Initialize repo with monorepo or separate `frontend`/`backend` packages.
- [ ] Set up React + TypeScript + Vite, linting (ESLint), and formatting (Prettier).
- [ ] Implement auth flow (sign-in, session handling) and user model.
- [ ] Design DB schema for channels, DMs, messages, files, and memory entities.
- [ ] Implement WebSocket gateway and basic `sendMessage`/`messageReceived` events.
- [ ] Build minimal UI: channel list, message list, composer with typing indicators.
- [ ] Integrate file upload handling and message attachments.
- [ ] Add basic search endpoints across messages (foundation for Memory Bank search).
- [ ] Document API contracts and event payloads for future AI/memory features.
