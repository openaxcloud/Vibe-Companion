# Technical Context

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite
- **State Management**: Redux Toolkit, React Query, Zustand
- **Real-time**: WebSocket API, Socket.io-client
- **UI Components**: Tailwind CSS, Headless UI, React Hook Form
- **File Handling**: React Dropzone, image preview components

## Key Dependencies
```json
{
  "@reduxjs/toolkit": "^1.9.0",
  "@tanstack/react-query": "^4.0.0",
  "socket.io-client": "^4.7.0",
  "zustand": "^4.4.0",
  "react-dropzone": "^14.2.0",
  "tailwindcss": "^3.3.0"
}
```

## Environment Variables
- `VITE_WEBSOCKET_URL`: WebSocket server endpoint
- `VITE_API_BASE_URL`: REST API base URL
- `VITE_FILE_UPLOAD_URL`: File upload service endpoint
- `VITE_PUSH_VAPID_KEY`: Web push notifications public key