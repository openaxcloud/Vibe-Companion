// ecode.md
# rest-express

## Overview
This project now includes a full-stack dashboard with real-time charts, sortable/filterable data tables, user authentication, and dark mode support.

## Architecture Updates
- Frontend: React ^18.3.1, Vite, Tailwind, shadcn/ui, TanStack Query, Wouter, Chart.js for real-time charts, DataTables for tables, dark mode toggle
- Backend: Node.js, Express, WebSocket for real-time data, JWT auth, PostgreSQL via Drizzle ORM
- Features: WebSocket for live updates, auth with JWT, theme toggle, data table with sorting/filtering

## Key Changes
- Added WebSocket server for real-time data
- Implemented user auth with JWT
- Added dark mode toggle via Tailwind
- Integrated Chart.js for live charts
- Used DataTables for sortable/filterable tables

## Scripts
Remains unchanged

## Development Workflow
Updated to include WebSocket and auth setup