## Architecture Overview
- **Monorepo** (Turborepo): packages/ui, packages/api, packages/pwa
- **Real-time Layer** – Socket.IO rooms per channel/DM; Redis adapter for horizontal scale
- **CQRS-style** – Commands (sendMessage, react) via WebSocket events; Queries via REST/GraphQL
- **Event Sourcing Lite** – append-only messages table, projection workers for read models
- **Presence Service** – Redis key TTL with EXPIRE events broadcasting presence diff
- **File Service** – Signed S3 URLs, virus scan Lambda, thumbnail worker
- **Push Gateway** – FCM/APNs abstraction service using device tokens stored in Postgres
- **Rate Limiting** – sliding-window per user (Redis) for messages & uploads