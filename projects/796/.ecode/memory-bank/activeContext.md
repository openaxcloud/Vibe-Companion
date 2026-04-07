# Active Context & Next Steps (Memory Bank)

## Current Focus
- Initial setup of the full app: project scaffolding, real‑time infrastructure decisions, and core messaging flows.
- Establishing a Memory Bank of architecture, tech choices, and UX targets for consistent future work.

## Immediate Next Steps (Checklist)
- [ ] Scaffold React + TypeScript app, configure routing and base layout (sidebar + message pane).
- [ ] Implement API client and WebSocket client wrappers with type‑safe interfaces.
- [ ] Define domain models: User, Channel, ChannelMembership, DirectConversation, Message, FileAttachment.
- [ ] Implement auth flow (signup/login, JWT handling, session storage on client).
- [ ] Build core UI: channel list, DM list, message list, composer with file upload, typing indicator UI.
- [ ] Implement WebSocket events for message send/receive and typing indicators.
- [ ] Create basic file upload flow (client → API → object storage) and secure access URLs.
- [ ] Add minimal access control for private channels and DMs.
- [ ] Capture emerging conventions (naming, event schemas, folder structure) into the Memory Bank for reuse.
