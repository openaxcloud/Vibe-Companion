# System Architecture - Memory Bank

## Architecture Overview
- **Frontend**: React with TypeScript, real-time streaming UI
- **Memory Layer**: Vector database for conversation context and document embeddings
- **AI Layer**: OpenAI GPT-4.1 integration with streaming responses
- **Document Processing**: RAG pipeline with chunking and embedding
- **Code Execution**: Isolated sandbox environment with security controls

## Key Technical Decisions
- **Streaming Architecture**: Server-Sent Events for real-time responses
- **Vector Storage**: Pinecone/Weaviate for semantic search and memory
- **Document Pipeline**: LangChain for RAG implementation
- **Code Sandbox**: Docker containers with resource limits
- **State Management**: Zustand for client state, React Query for server state

## Design Patterns
- **Observer Pattern**: For streaming response handling
- **Strategy Pattern**: Multiple document processors (PDF, DOCX, etc.)
- **Command Pattern**: Code execution with rollback capabilities
- **Repository Pattern**: Conversation and document data access