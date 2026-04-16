# System Architecture - Memory Bank

## Architecture Overview
- **Frontend**: React TypeScript SPA with real-time streaming
- **Backend**: Node.js API with WebSocket support
- **Vector Database**: Pinecone/Weaviate for RAG document storage
- **Code Execution**: Docker containers with security isolation
- **Memory Storage**: PostgreSQL for conversation persistence

## Key Technical Decisions
- Server-Sent Events (SSE) for streaming GPT responses
- Vector embeddings for document similarity search
- Sandboxed Docker containers for code execution
- React Query for state management and caching
- i18next for internationalization

## Design Patterns
- Repository pattern for data access abstraction
- Observer pattern for real-time response streaming
- Strategy pattern for different code execution environments
- Factory pattern for multi-language content generation
- Middleware pattern for request processing pipeline