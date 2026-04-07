# Active Context – Initial Focus & Next Steps

## Current Focus
- Establish core project structure for a TypeScript React frontend and Node backend.
- Implement minimal vertical slice: auth + basic channel list + real-time messaging in one channel.
- Set up WebSocket infrastructure, DB schema foundations, and environment configuration.

## Next Steps Checklist
- [ ] Initialize mono-repo or multi-project workspace (e.g., pnpm workspace or Nx/Turborepo).
- [ ] Create React TypeScript app with routing, auth layout, and base UI components.
- [ ] Scaffold Node/TS backend with REST + WebSocket gateway and config module.
- [ ] Set up Postgres + Prisma/TypeORM; define core models: User, Channel, Membership, Message, Thread, Reaction.
- [ ] Integrate Redis for presence and WebSocket pub/sub.
- [ ] Implement auth (signup/login, JWT, refresh tokens, protected routes and WS auth handshake).
- [ ] Implement basic message send/receive flow for a single channel with WebSocket broadcast.
- [ ] Add typing indicators and simple presence (online/offline) tracking.
- [ ] Configure file storage service with signed upload URLs and basic attachment message type.
- [ ] Add minimal logging and error handling, with structured logs for message events.
- [ ] Document API contracts (REST + WS events) and finalize initial UX flows.
