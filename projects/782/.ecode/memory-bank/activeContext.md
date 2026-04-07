# Active Context – Current Focus & Next Steps

## Current Focus
- Initial project setup for the Slack-like messaging platform with Memory Bank support.
- Define minimal vertical slice: auth + join workspace + single channel messaging with WebSockets.
- Establish baseline architecture, folder structure, and coding standards in TypeScript/React.

## Immediate Next Steps (Checklist)
- [ ] Initialize monorepo or separate frontend/backend repos in TypeScript.
- [ ] Configure linting, formatting, TypeScript strict mode, and basic CI checks.
- [ ] Implement backend auth (JWT) and basic user/workspace models.
- [ ] Stand up WebSocket server and define event contracts (join_room, message_send, typing_start/stop).
- [ ] Implement React app shell: routing, auth views, basic channel layout.
- [ ] Wire WebSocket client to display real-time messages in one test channel.
- [ ] Add minimal file upload API and client integration (no previews yet).
- [ ] Start Memory Bank log of ADRs and key technical/UX decisions in this project.

## Short-term Expansion
- [ ] Implement multiple channels (public/private) and DM creation flow.
- [ ] Add typing indicators and basic presence (online/offline).
- [ ] Introduce pagination & caching for message history.
- [ ] Refine file sharing UX and security controls.