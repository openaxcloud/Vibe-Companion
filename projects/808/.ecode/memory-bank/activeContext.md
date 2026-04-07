# Active Context & Next Steps

## Current Focus
- Define the Memory Bank (core domain entities and their relationships) for the messaging app.
- Set up React + TypeScript base project with routing and state management.
- Establish WebSocket client abstraction and basic connection lifecycle.

## Immediate Next Steps (Checklist)
- [ ] Initialize React + TypeScript project (Vite or CRA alternative).
- [ ] Configure linting, formatting, and basic testing pipeline.
- [ ] Define TypeScript models for User, Channel, Message, TypingEvent, FileResource.
- [ ] Implement a WebSocket service module (connect, reconnect, subscribe, publish).
- [ ] Implement global app layout: sidebar (channels/DMs) + main chat view.
- [ ] Create placeholder REST client for auth, channels, and messages.
- [ ] Wire initial real-time flow: join channel → receive mock messages over WS.
- [ ] Add simple in-memory store for messages and channels (normalize by ID).
- [ ] Document message/event shapes between client and server for future backend work.
