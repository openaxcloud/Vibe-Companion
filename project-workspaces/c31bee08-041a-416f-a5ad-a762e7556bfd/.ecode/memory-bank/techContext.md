# Technical Stack

## Frontend Stack
- **React 18** with TypeScript for UI components
- **Zustand** for client-side state management
- **Socket.io-client** for WebSocket connections
- **React Query** for server state caching
- **Tailwind CSS** for styling
- **React Hook Form** for form handling

## Backend Requirements
- **Node.js/Express** with Socket.io server
- **PostgreSQL** for message and user data
- **Redis** for real-time presence and caching
- **AWS S3/CloudFront** for file storage and CDN

## Key Dependencies
```json
{
  "socket.io-client": "^4.7.0",
  "zustand": "^4.4.0",
  "@tanstack/react-query": "^4.29.0",
  "react-hook-form": "^7.45.0"
}
```

## Environment Variables
- `VITE_WEBSOCKET_URL`: WebSocket server endpoint
- `VITE_API_BASE_URL`: REST API base URL
- `VITE_FILE_UPLOAD_URL`: File upload service URL