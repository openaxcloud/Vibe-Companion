export { RAGEngine, getOrCreateEngine, getEngine, removeEngine } from './engine';
export type { RAGEngineConfig, ContextChunk } from './engine';
export { chunkFile, detectLanguage } from './chunker';
export type { CodeChunk } from './chunker';
export { generateEmbedding, generateEmbeddingsBatch, isEmbeddingAvailable } from './embedding.service';
export { hybridSearch, searchByVector, searchByFTS, getProjectStats, initRAGDatabase } from './vector-store';
export type { StoredChunk, SearchResult } from './vector-store';
