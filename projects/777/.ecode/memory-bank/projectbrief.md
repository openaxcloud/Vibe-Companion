## Slack-like Real-Time Messenger

### Mission
Build a production-grade, WebSocket-first workplace chat platform rivaling Slack with faster sync, richer presence, and native-grade push.

### Core Requirements
- Real-time bidirectional messaging via WebSockets (Socket.IO)
- Public & private channels, DMs, group DMs
- File/image upload (S3) with in-line preview
- Emoji reactions & infinite threading
- Live typing indicators per channel
- Read receipts (per message, per user)
- Presence: online/away/offline + custom status
- Cross-platform push (FCM / APNs)

### Non-goals
Video/voice calls, email bridges, enterprise SSO (phase 2).