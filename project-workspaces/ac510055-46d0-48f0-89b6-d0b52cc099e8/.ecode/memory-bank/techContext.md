# Technical Context - Memory Bank

## Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Framer Motion
- **State Management**: Zustand, React Query (TanStack Query)
- **UI Components**: Radix UI, Lucide React icons
- **Streaming**: Server-Sent Events, EventSource API
- **File Processing**: react-dropzone, pdf-parse, mammoth (DOCX)
- **Internationalization**: react-i18next
- **PDF Export**: jsPDF, html2canvas

## Key Dependencies
```json
"openai": "^4.20.0",
"@langchain/core": "^0.1.0",
"@pinecone-database/pinecone": "^1.1.0",
"framer-motion": "^10.16.0",
"zustand": "^4.4.0"
```

## Environment Variables
```
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=memory-bank
CODE_SANDBOX_URL=...
NEXT_PUBLIC_APP_URL=...
```

## Development Setup
- Node.js 18+, pnpm package manager
- Docker for code sandbox
- Vector database setup (Pinecone/local)