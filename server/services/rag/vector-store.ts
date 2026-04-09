import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { createLogger } from '../../utils/logger';
import { EMBEDDING_DIMENSIONS } from './embedding.service';

const logger = createLogger('rag-vector-store');

let initialized = false;

export async function initRAGDatabase(): Promise<boolean> {
  if (initialized) return true;
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS code_embeddings (
        id TEXT PRIMARY KEY,
        project_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        chunk_index INTEGER NOT NULL DEFAULT 0,
        chunk_type TEXT NOT NULL DEFAULT 'file',
        content TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'text',
        start_line INTEGER,
        end_line INTEGER,
        symbol_name TEXT,
        symbol_type TEXT,
        imports TEXT[] DEFAULT '{}',
        exports TEXT[] DEFAULT '{}',
        embedding vector(1536),
        file_hash TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(project_id, file_path, chunk_index)
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rag_index_status (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'idle',
        total_files INTEGER DEFAULT 0,
        indexed_files INTEGER DEFAULT 0,
        total_chunks INTEGER DEFAULT 0,
        last_indexed_at TIMESTAMPTZ,
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    try {
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_code_embeddings_project ON code_embeddings(project_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_code_embeddings_file ON code_embeddings(project_id, file_path)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_code_embeddings_fts ON code_embeddings USING gin(to_tsvector('english', content))`);
    } catch (indexErr: any) {
      logger.debug(`Index creation (non-critical): ${indexErr.message}`);
    }

    try {
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_code_embeddings_vector ON code_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`);
    } catch (vecErr: any) {
      logger.debug(`Vector index (needs data first): ${vecErr.message}`);
    }

    initialized = true;
    logger.info('RAG database initialized successfully');
    return true;
  } catch (err: any) {
    logger.error(`RAG database initialization failed: ${err.message}`);
    return false;
  }
}

export interface StoredChunk {
  id: string;
  projectId: number;
  filePath: string;
  chunkIndex: number;
  chunkType: string;
  content: string;
  language: string;
  startLine: number | null;
  endLine: number | null;
  symbolName: string | null;
  symbolType: string | null;
  imports: string[];
  exports: string[];
  fileHash: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  similarity?: number;
}

export interface SearchResult {
  chunk: StoredChunk;
  score: number;
  matchType: 'vector' | 'fts' | 'hybrid';
}

export async function upsertChunk(chunk: {
  id: string;
  projectId: number;
  filePath: string;
  chunkIndex: number;
  chunkType: string;
  content: string;
  language: string;
  startLine?: number;
  endLine?: number;
  symbolName?: string;
  symbolType?: string;
  imports?: string[];
  exports?: string[];
  embedding?: number[] | null;
  fileHash?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const embeddingVal = chunk.embedding
    ? sql`${JSON.stringify(chunk.embedding)}::vector`
    : sql`NULL`;

  await db.execute(sql`
    INSERT INTO code_embeddings (id, project_id, file_path, chunk_index, chunk_type, content, language, start_line, end_line, symbol_name, symbol_type, imports, exports, embedding, file_hash, metadata, created_at, updated_at)
    VALUES (
      ${chunk.id}, ${chunk.projectId}, ${chunk.filePath}, ${chunk.chunkIndex},
      ${chunk.chunkType}, ${chunk.content}, ${chunk.language},
      ${chunk.startLine ?? null}, ${chunk.endLine ?? null},
      ${chunk.symbolName ?? null}, ${chunk.symbolType ?? null},
      ${chunk.imports ? sql`${chunk.imports}::text[]` : sql`'{}'::text[]`},
      ${chunk.exports ? sql`${chunk.exports}::text[]` : sql`'{}'::text[]`},
      ${embeddingVal},
      ${chunk.fileHash ?? null},
      ${JSON.stringify(chunk.metadata || {})}::jsonb,
      NOW(), NOW()
    )
    ON CONFLICT (project_id, file_path, chunk_index)
    DO UPDATE SET
      chunk_type = EXCLUDED.chunk_type,
      content = EXCLUDED.content,
      language = EXCLUDED.language,
      start_line = EXCLUDED.start_line,
      end_line = EXCLUDED.end_line,
      symbol_name = EXCLUDED.symbol_name,
      symbol_type = EXCLUDED.symbol_type,
      imports = EXCLUDED.imports,
      exports = EXCLUDED.exports,
      embedding = EXCLUDED.embedding,
      file_hash = EXCLUDED.file_hash,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
  `);
}

export async function deleteFileChunks(projectId: number, filePath: string): Promise<void> {
  await db.execute(sql`
    DELETE FROM code_embeddings WHERE project_id = ${projectId} AND file_path = ${filePath}
  `);
}

export async function deleteProjectChunks(projectId: number): Promise<void> {
  await db.execute(sql`
    DELETE FROM code_embeddings WHERE project_id = ${projectId}
  `);
}

export async function searchByVector(
  projectId: number,
  queryEmbedding: number[],
  limit: number = 10,
  minScore: number = 0.3,
  fileFilter?: string
): Promise<SearchResult[]> {
  const vecStr = JSON.stringify(queryEmbedding);
  const filterClause = fileFilter
    ? sql`AND file_path LIKE ${`%${fileFilter}%`}`
    : sql``;

  const results = await db.execute(sql`
    SELECT *,
      1 - (embedding <=> ${vecStr}::vector) as similarity
    FROM code_embeddings
    WHERE project_id = ${projectId}
      AND embedding IS NOT NULL
      ${filterClause}
    ORDER BY embedding <=> ${vecStr}::vector
    LIMIT ${limit}
  `) as unknown as { rows: any[] };

  return results.rows
    .filter((r: any) => r.similarity >= minScore)
    .map((r: any) => ({
      chunk: rowToChunk(r),
      score: parseFloat(r.similarity),
      matchType: 'vector' as const,
    }));
}

export async function searchByFTS(
  projectId: number,
  query: string,
  limit: number = 10,
  fileFilter?: string
): Promise<SearchResult[]> {
  const filterClause = fileFilter
    ? sql`AND file_path LIKE ${`%${fileFilter}%`}`
    : sql``;

  const results = await db.execute(sql`
    SELECT *,
      ts_rank(to_tsvector('english', content), plainto_tsquery('english', ${query})) as rank
    FROM code_embeddings
    WHERE project_id = ${projectId}
      AND to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
      ${filterClause}
    ORDER BY rank DESC
    LIMIT ${limit}
  `) as unknown as { rows: any[] };

  return results.rows.map((r: any) => ({
    chunk: rowToChunk(r),
    score: parseFloat(r.rank || '0'),
    matchType: 'fts' as const,
  }));
}

export async function hybridSearch(
  projectId: number,
  query: string,
  queryEmbedding: number[] | null,
  limit: number = 10,
  fileFilter?: string
): Promise<SearchResult[]> {
  const vectorResults = queryEmbedding
    ? await searchByVector(projectId, queryEmbedding, limit * 2, 0.2, fileFilter)
    : [];

  const ftsResults = await searchByFTS(projectId, query, limit * 2, fileFilter);

  const merged = new Map<string, SearchResult>();
  const VECTOR_WEIGHT = 0.7;
  const FTS_WEIGHT = 0.3;

  for (const r of vectorResults) {
    merged.set(r.chunk.id, {
      chunk: r.chunk,
      score: r.score * VECTOR_WEIGHT,
      matchType: 'hybrid',
    });
  }

  for (const r of ftsResults) {
    const existing = merged.get(r.chunk.id);
    if (existing) {
      existing.score += r.score * FTS_WEIGHT;
    } else {
      merged.set(r.chunk.id, {
        chunk: r.chunk,
        score: r.score * FTS_WEIGHT,
        matchType: r.matchType,
      });
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function getProjectStats(projectId: number): Promise<{
  totalChunks: number;
  embeddedChunks: number;
  totalFiles: number;
  languages: Record<string, number>;
  chunkTypes: Record<string, number>;
}> {
  const statsResult = await db.execute(sql`
    SELECT
      COUNT(*) as total_chunks,
      COUNT(embedding) as embedded_chunks,
      COUNT(DISTINCT file_path) as total_files
    FROM code_embeddings
    WHERE project_id = ${projectId}
  `) as unknown as { rows: any[] };

  const langResult = await db.execute(sql`
    SELECT language, COUNT(*) as count
    FROM code_embeddings
    WHERE project_id = ${projectId}
    GROUP BY language
  `) as unknown as { rows: any[] };

  const typeResult = await db.execute(sql`
    SELECT chunk_type, COUNT(*) as count
    FROM code_embeddings
    WHERE project_id = ${projectId}
    GROUP BY chunk_type
  `) as unknown as { rows: any[] };

  const stats = statsResult.rows[0] || {};
  return {
    totalChunks: parseInt(stats.total_chunks || '0'),
    embeddedChunks: parseInt(stats.embedded_chunks || '0'),
    totalFiles: parseInt(stats.total_files || '0'),
    languages: Object.fromEntries(langResult.rows.map((r: any) => [r.language, parseInt(r.count)])),
    chunkTypes: Object.fromEntries(typeResult.rows.map((r: any) => [r.chunk_type, parseInt(r.count)])),
  };
}

export async function getIndexStatus(projectId: number): Promise<{
  indexingInProgress: boolean;
  totalFiles: number;
  indexedFiles: number;
  totalChunks: number;
  lastIndexedAt: string | null;
  errorCount: number;
  lastError: string | null;
} | null> {
  const result = await db.execute(sql`
    SELECT * FROM rag_index_status WHERE project_id = ${projectId}
  `) as unknown as { rows: any[] };

  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    indexingInProgress: row.indexing_in_progress,
    totalFiles: parseInt(row.total_files || '0'),
    indexedFiles: parseInt(row.indexed_files || '0'),
    totalChunks: parseInt(row.total_chunks || '0'),
    lastIndexedAt: row.last_indexed_at,
    errorCount: parseInt(row.error_count || '0'),
    lastError: row.last_error,
  };
}

export async function updateIndexStatus(projectId: number, update: Record<string, unknown>): Promise<void> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, val] of Object.entries(update)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    setClauses.push(`${snakeKey} = $${values.length + 2}`);
    values.push(val);
  }

  setClauses.push('updated_at = NOW()');

  await db.execute(sql.raw(`
    INSERT INTO rag_index_status (project_id, ${Object.keys(update).map(k => k.replace(/([A-Z])/g, '_$1').toLowerCase()).join(', ')}, updated_at)
    VALUES ($1, ${values.map((_, i) => `$${i + 2}`).join(', ')}, NOW())
    ON CONFLICT (project_id)
    DO UPDATE SET ${setClauses.join(', ')}
  `));
}

export async function setIndexStatus(projectId: number, updates: Partial<{
  totalFiles: number;
  indexedFiles: number;
  totalChunks: number;
  lastIndexedAt: string;
  indexingInProgress: boolean;
  errorCount: number;
  lastError: string | null;
  fileHashes: Record<string, string>;
}>): Promise<void> {
  const sets: string[] = [];
  if (updates.totalFiles !== undefined) sets.push(`total_files = ${updates.totalFiles}`);
  if (updates.indexedFiles !== undefined) sets.push(`indexed_files = ${updates.indexedFiles}`);
  if (updates.totalChunks !== undefined) sets.push(`total_chunks = ${updates.totalChunks}`);
  if (updates.lastIndexedAt !== undefined) sets.push(`last_indexed_at = '${updates.lastIndexedAt}'`);
  if (updates.indexingInProgress !== undefined) sets.push(`indexing_in_progress = ${updates.indexingInProgress}`);
  if (updates.errorCount !== undefined) sets.push(`error_count = ${updates.errorCount}`);
  if (updates.lastError !== undefined) sets.push(`last_error = ${updates.lastError === null ? 'NULL' : `'${updates.lastError.replace(/'/g, "''")}'`}`);
  if (updates.fileHashes !== undefined) sets.push(`file_hashes = '${JSON.stringify(updates.fileHashes)}'::jsonb`);
  sets.push('updated_at = NOW()');

  await db.execute(sql.raw(`
    INSERT INTO rag_index_status (project_id, updated_at) VALUES (${projectId}, NOW())
    ON CONFLICT (project_id) DO UPDATE SET ${sets.join(', ')}
  `));
}

function rowToChunk(row: any): StoredChunk {
  return {
    id: row.id,
    projectId: row.project_id,
    filePath: row.file_path,
    chunkIndex: row.chunk_index,
    chunkType: row.chunk_type,
    content: row.content,
    language: row.language,
    startLine: row.start_line,
    endLine: row.end_line,
    symbolName: row.symbol_name,
    symbolType: row.symbol_type,
    imports: row.imports || [],
    exports: row.exports || [],
    fileHash: row.file_hash,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    similarity: row.similarity ? parseFloat(row.similarity) : undefined,
  };
}
