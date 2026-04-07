# Slack-like Messaging MVP

This repository contains a full-stack, Slack-like messaging MVP with:

- Real-time messaging in channels and direct messages
- Threaded replies
- Basic authentication and authorization
- Team- and channel-scoped data separation
- Modern React frontend with TypeScript
- Node.js/Express backend with PostgreSQL and WebSocket support

The project is structured as a monorepo with two main apps:

- backend/ – REST + WebSocket API, authentication, persistence
- frontend/ – React client app

---

## Architecture Overview

### High-Level Architecture

The system is split into three major parts:

1. Client (frontend)
   - React + TypeScript single-page application
   - Communicates with backend via:
     - REST (HTTP/JSON) for CRUD operations and auth
     - WebSockets for real-time message and presence updates
   - Uses local storage for auth tokens
   - State management with React Query (server state) and React Context (auth + UI state)

2. API Server (backend)
   - Node.js + Express
   - PostgreSQL database via an ORM (e.g., Prisma or TypeORM)
   - WebSocket server (ws or Socket.IO style, depending on implementation)
   - Auth with JWT (access + refresh tokens)
   - Organized by modules: auth, users, teams, channels, messages

3. Database (PostgreSQL)
   - Core entities:
     - User
     - Team
     - Channel
     - ChannelMembership
     - Message
     - Thread (optional: threadId on Message)
     - DirectMessageConversation
     - DirectMessageParticipant
   - Indexed for queries by team, channel, and user

### Data Model (Conceptual)

User
- id
- email
- passwordHash
- name
- avatarUrl
- createdAt
- updatedAt

Team
- id
- name
- slug
- createdAt
- updatedAt

Channel
- id
- teamId
- name
- isPrivate
- createdAt
- updatedAt

ChannelMembership
- id
- channelId
- userId
- role (member, admin)
- createdAt

Message
- id
- teamId
- channelId (nullable for direct messages)
- conversationId (for direct messages)
- userId
- text
- parentId (nullable for threads)
- createdAt
- updatedAt

DirectMessageConversation
- id
- teamId
- createdAt

DirectMessageParticipant
- id
- conversationId
- userId
- createdAt

### Communication Flows

Auth
- Client sends credentials to /auth/login
- Backend validates and returns:
  - accessToken (short-lived)
  - refreshToken (httpOnly cookie or separate storage strategy)
- Client attaches accessToken as an Authorization: Bearer header for API calls
- Client uses refresh endpoint when accessToken expires

Real-time messaging
- Client opens WebSocket connection after login, authenticated via JWT
- Client subscribes to:
  - team rooms
  - channel rooms
  - direct message conversation rooms
- When a message is created via REST or WebSocket:
  - Backend writes to DB
  - Backend broadcasts message event to relevant rooms
- Clients listening receive the new message and update their UI

---

## Features

Core features (MVP):

- User authentication (signup, login, logout)
- Team selection / switching
- Public channels per team
- Private channels (optional toggle; membership required)
- Direct messages between one or more users (group DMs)
- Message list with timestamps and author info
- Threaded replies:
  - Messages can have child messages (threads)
  - Thread view per parent message
- Real-time updates:
  - New messages appear without full refresh
  - Typing indicators (optional, depending on implementation)
  - Basic presence support (online/offline)

Developer-focused features:

- Environment-based configuration
- TypeScript everywhere (backend + frontend)
- ESLint + Prettier (recommended)
- Simple scripts for setup, migrations, and dev

---

## Tech Stack

Backend:
- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma or TypeORM (depending on implementation)
- WebSockets (ws or Socket.IO-based)
- JWT authentication
- dotenv for environment variables

Frontend:
- React
- TypeScript
- Vite or Create React App (depending on implementation)
- React Router
- React Query
- Styled with CSS Modules / Tailwind / styled-components (implementation-specific)
- WebSocket client

---

## Monorepo Structure

/ (root)
- package.json (if using workspaces)
- README.md
- .env.example

/backend
- src/
  - app.ts or main.ts (entrypoint)
  - server.ts (HTTP and WebSocket bootstrapping)
  - config/
    - env.ts
    - logger.ts
  - modules/
    - auth/
    - users/
    - teams/
    - channels/
    - messages/
    - conversations/
  - db/
    - client.ts
    - migrations/
- prisma/ or ormconfig files (if using Prisma/TypeORM)
- package.json
- tsconfig.json
- .env.example

/frontend
- src/
  - main.tsx
  - App.tsx
  - api/
  - components/
  - hooks/
  - pages/
  - context/
  - styles/
- index.html
- vite.config.ts or similar
- package.json
- tsconfig.json
- .env.example

---

## Prerequisites

- Node.js (LTS, e.g., 18+)
- npm or yarn or pnpm
- PostgreSQL (13+ recommended)
- Git

---

## Environment Configuration

The project uses environment variables for configuration. There are three sets:

- Root-level: optional, or just for tooling.
- Backend: server, database, auth config.
- Frontend: API base URL, WebSocket URL.

### Backend .env configuration

Copy backend/.env.example to backend/.env and set values:

NODE_ENV=development
PORT=4000

DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/slack_mvp

JWT_ACCESS_TOKEN_SECRET=replace-with-strong-random-string
JWT_ACCESS_TOKEN_EXPIRES_IN=15m

JWT_REFRESH_TOKEN_SECRET=replace-with-strong-random-string
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173

WEBSOCKET_PATH=/ws

Adjust:
- USER and PASSWORD to match your local Postgres user credentials.
- CORS_ORIGIN to match frontend dev URL.
- Secrets to secure random strings in production.

### Frontend .env configuration

Copy frontend/.env.example to frontend/.env and set values:

VITE_API_BASE_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000/ws

Adjust for production:
- Use https and wss URLs
- Deploy environment-specific values for staging/production

---

## Backend Setup

1) Install dependencies

From the backend directory:

npm install
or
yarn install
or
pnpm install

2) Configure database

Ensure PostgreSQL is running and that the DATABASE_URL in backend/.env is valid.

3) Run migrations

Depending on ORM:

For Prisma-style:

npx prisma migrate dev

For TypeORM-style (example):

npm run typeorm migration:run

Check the backend package.json for the exact migration scripts:

npm run db:migrate

4) Seed initial data (optional)

If the project includes a seed script, run:

npm run db:seed

This may create:
- A demo team
- A sample user
- One or more channels

5) Start the backend server

npm run dev

This should:
- Start the Express server on the configured PORT
- Start WebSocket server on the same port (e.g., /ws)
- Automatically reload on file changes (nodemon / ts-node-dev, etc.)

For production build:

npm run build
npm run start

---

## Frontend Setup

1) Install dependencies

From the frontend directory:

npm install
or
yarn install
or
pnpm install

2) Ensure environment configuration

Check frontend/.env to ensure VITE_API_BASE_URL and VITE_WS_URL match the backend:

VITE_API_BASE_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000/ws

3) Start the dev server

npm run dev

You should see an output like:

- Local: http://localhost:5173/

Open that URL in your browser.

For production build:

npm run build
npm run preview

---

## Local Development Workflow

1) Start database
   - Ensure PostgreSQL is running and accessible.

2) Start backend

cd backend
npm run dev

3) Start frontend

cd frontend
npm run dev

4) Open app in browser

Visit the frontend dev URL (e.g., http://localhost:5173).

5) Create or use test account

Use the signup flow or any seeded accounts to log in.

---

## Authentication and Authorization

- Users authenticate via email and password.
- Passwords are hashed (e.g., bcrypt).
- Successful login returns:
  - accessToken: used in Authorization headers.
  - refreshToken: used for refreshing access token (secure storage, e.g., cookie-based).
- Access token verifies:
  - User identity
  - Permissions (team membership, channel membership)

Protected routes:

- Most API endpoints under /teams, /channels, /messages require