// @ts-nocheck
/**
 * Database Streaming Utilities
 * Fortune 500-grade memory optimization using generators
 * 
 * Implements Replit-style lazy evaluation patterns to prevent
 * loading entire result sets into memory.
 * 
 * Date: December 7, 2025
 * Status: Production-ready
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Readable } from 'stream';
import type Archiver from 'archiver';
import { Pool, PoolClient } from 'pg';
import { createLogger } from './logger';

const logger = createLogger('db-streaming');

/**
 * Configuration for cursor-based pagination
 */
export interface CursorPaginationConfig {
  /** Number of items per batch (default: 100) */
  batchSize: number;
  /** Maximum total items to return (default: 10000) */
  maxItems: number;
  /** Cursor field name (default: 'id') */
  cursorField: string;
}

const DEFAULT_CONFIG: CursorPaginationConfig = {
  batchSize: 100,
  maxItems: 10000,
  cursorField: 'id'
};

/**
 * Async generator that streams database results in batches
 * Prevents loading entire result sets into memory
 * 
 * @example
 * ```typescript
 * const stream = streamDbResults(
 *   async (cursor, limit) => db.query.logs.findMany({
 *     where: cursor ? gt(logs.id, cursor) : undefined,
 *     limit,
 *     orderBy: [asc(logs.id)]
 *   }),
 *   { batchSize: 100, maxItems: 1000 }
 * );
 * 
 * for await (const item of stream) {
 *   process(item);
 * }
 * ```
 */
export async function* streamDbResults<T extends Record<string, any>>(
  fetchBatch: (cursor: any, limit: number) => Promise<T[]>,
  config: Partial<CursorPaginationConfig> = {}
): AsyncGenerator<T, void, unknown> {
  const opts = { ...DEFAULT_CONFIG, ...config };
  let cursor: any = null;
  let totalYielded = 0;
  let batchNumber = 0;

  while (totalYielded < opts.maxItems) {
    batchNumber++;
    const remainingItems = opts.maxItems - totalYielded;
    const batchLimit = Math.min(opts.batchSize, remainingItems);

    const batch = await fetchBatch(cursor, batchLimit);
    
    if (batch.length === 0) {
      logger.debug(`[Stream] Completed after ${batchNumber} batches, ${totalYielded} items`);
      break;
    }

    for (const item of batch) {
      yield item;
      totalYielded++;
    }

    // Update cursor for next batch
    const lastItem = batch[batch.length - 1];
    cursor = lastItem[opts.cursorField];

    // If we got fewer than requested, we've reached the end
    if (batch.length < batchLimit) {
      logger.debug(`[Stream] End of results after ${batchNumber} batches, ${totalYielded} items`);
      break;
    }
  }

  if (totalYielded >= opts.maxItems) {
    logger.warn(`[Stream] Hit max items limit: ${opts.maxItems}`);
  }
}

/**
 * Transform generator - applies a transformation to each item lazily
 * Memory-efficient alternative to .map() on large arrays
 */
export async function* transformStream<T, R>(
  source: AsyncGenerator<T>,
  transform: (item: T) => R | Promise<R>
): AsyncGenerator<R, void, unknown> {
  for await (const item of source) {
    yield await transform(item);
  }
}

/**
 * Filter generator - filters items lazily without loading all into memory
 * Memory-efficient alternative to .filter() on large arrays
 */
export async function* filterStream<T>(
  source: AsyncGenerator<T>,
  predicate: (item: T) => boolean | Promise<boolean>
): AsyncGenerator<T, void, unknown> {
  for await (const item of source) {
    if (await predicate(item)) {
      yield item;
    }
  }
}

/**
 * Take generator - takes first N items from a stream
 * Stops iteration early for efficiency
 */
export async function* takeStream<T>(
  source: AsyncGenerator<T>,
  count: number
): AsyncGenerator<T, void, unknown> {
  let taken = 0;
  for await (const item of source) {
    if (taken >= count) break;
    yield item;
    taken++;
  }
}

/**
 * Skip generator - skips first N items from a stream
 */
export async function* skipStream<T>(
  source: AsyncGenerator<T>,
  count: number
): AsyncGenerator<T, void, unknown> {
  let skipped = 0;
  for await (const item of source) {
    if (skipped < count) {
      skipped++;
      continue;
    }
    yield item;
  }
}

/**
 * Collect generator results into an array
 * Use sparingly - only when you actually need the full array
 */
export async function collectStream<T>(
  source: AsyncGenerator<T>,
  maxItems: number = 10000
): Promise<T[]> {
  const results: T[] = [];
  let count = 0;
  
  for await (const item of source) {
    if (count >= maxItems) {
      logger.warn(`[collectStream] Hit max items limit: ${maxItems}`);
      break;
    }
    results.push(item);
    count++;
  }
  
  return results;
}

/**
 * Stream file lines lazily using async generators
 * Memory-efficient alternative to reading entire file
 * Uses fs/promises for Replit-style memory optimization
 */
export async function* streamFileLines(
  filePath: string
): AsyncGenerator<string, void, unknown> {
  let fileHandle: fs.FileHandle | null = null;
  
  try {
    fileHandle = await fs.open(filePath, 'r');
    const stream = fileHandle.createReadStream({ encoding: 'utf-8' });
    let buffer = '';
    
    for await (const chunk of stream) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        yield line;
      }
    }
    
    if (buffer) {
      yield buffer;
    }
  } catch (error) {
    logger.error(`[streamFileLines] Error reading file ${filePath}:`, error);
    throw error;
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
}

/**
 * Batch generator - groups items into batches for bulk processing
 */
export async function* batchStream<T>(
  source: AsyncGenerator<T>,
  batchSize: number
): AsyncGenerator<T[], void, unknown> {
  let batch: T[] = [];
  
  for await (const item of source) {
    batch.push(item);
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }
  
  // Yield remaining items
  if (batch.length > 0) {
    yield batch;
  }
}

/**
 * SSE (Server-Sent Events) streaming helper
 * Converts async generator to SSE format for real-time responses
 */
export async function* toSSEStream<T>(
  source: AsyncGenerator<T>,
  eventType: string = 'message'
): AsyncGenerator<string, void, unknown> {
  for await (const item of source) {
    const data = typeof item === 'string' ? item : JSON.stringify(item);
    yield `event: ${eventType}\ndata: ${data}\n\n`;
  }
  yield `event: done\ndata: {"completed": true}\n\n`;
}

/**
 * Pipeline helper - compose multiple stream transformations
 */
export function pipelineStream<T, R>(
  source: AsyncGenerator<T>,
  ...transforms: Array<(gen: AsyncGenerator<any>) => AsyncGenerator<any>>
): AsyncGenerator<R> {
  let current: AsyncGenerator<any> = source;
  for (const transform of transforms) {
    current = transform(current);
  }
  return current as AsyncGenerator<R>;
}

/**
 * Options for streaming directory files
 */
export interface StreamDirectoryOptions {
  /** Whether to recursively traverse subdirectories (default: false) */
  recursive?: boolean;
  /** Optional file extension filter (e.g., '.ts', '.js') */
  extensions?: string[];
  /** Optional pattern to exclude files/directories */
  exclude?: RegExp;
}

/**
 * Stream directory files lazily using async generators
 * Memory-efficient alternative to building array of all files
 * Yields file paths one-by-one instead of loading entire directory tree
 * 
 * @example
 * ```typescript
 * for await (const filePath of streamDirectoryFiles('./src', { recursive: true })) {
 *   console.log(filePath);
 * }
 * ```
 */
export async function* streamDirectoryFiles(
  dirPath: string,
  options?: StreamDirectoryOptions
): AsyncGenerator<string, void, unknown> {
  const opts = {
    recursive: false,
    extensions: undefined,
    exclude: undefined,
    ...options
  };

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // Check exclusion pattern
      if (opts.exclude && opts.exclude.test(fullPath)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        if (opts.recursive) {
          yield* streamDirectoryFiles(fullPath, opts);
        }
      } else if (entry.isFile()) {
        // Filter by extension if specified
        if (opts.extensions && opts.extensions.length > 0) {
          const ext = path.extname(entry.name);
          if (!opts.extensions.includes(ext)) {
            continue;
          }
        }
        yield fullPath;
      }
    }
  } catch (error) {
    logger.error(`[streamDirectoryFiles] Error reading directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Options for piping stream to archive
 */
export interface PipeToArchiveOptions {
  /** Name/path of the file in the archive */
  archivePath?: string;
  /** Whether to store or compress (default: compress) */
  store?: boolean;
}

/**
 * Pipes a file stream directly to an archiver without buffering entire file
 * Memory-efficient for large file archiving
 * 
 * @example
 * ```typescript
 * import archiver from 'archiver';
 * 
 * const archive = archiver('zip', { zlib: { level: 9 } });
 * archive.pipe(output);
 * 
 * await pipeStreamToArchive(archive, '/path/to/large-file.log', {
 *   archivePath: 'logs/file.log'
 * });
 * 
 * await archive.finalize();
 * ```
 */
export async function pipeStreamToArchive(
  archive: Archiver,
  filePath: string,
  options?: PipeToArchiveOptions
): Promise<void> {
  const opts = {
    archivePath: path.basename(filePath),
    store: false,
    ...options
  };

  let fileHandle: fs.FileHandle | null = null;
  
  try {
    // Check if file exists and get stats
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    // Open file and create read stream
    fileHandle = await fs.open(filePath, 'r');
    const stream = fileHandle.createReadStream();

    // Append stream to archive
    archive.append(stream as unknown as Readable, {
      name: opts.archivePath,
      store: opts.store
    });

    // Wait for the stream to be consumed
    await new Promise<void>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    logger.debug(`[pipeStreamToArchive] Added ${filePath} as ${opts.archivePath}`);
  } catch (error) {
    logger.error(`[pipeStreamToArchive] Error archiving ${filePath}:`, error);
    throw error;
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
}

/**
 * Pipes multiple files from a directory to an archive using streaming
 * Memory-efficient for archiving large directories
 * 
 * @example
 * ```typescript
 * import archiver from 'archiver';
 * 
 * const archive = archiver('zip', { zlib: { level: 9 } });
 * archive.pipe(output);
 * 
 * await pipeDirectoryToArchive(archive, './logs', {
 *   recursive: true,
 *   baseDir: 'backup/logs'
 * });
 * 
 * await archive.finalize();
 * ```
 */
export async function pipeDirectoryToArchive(
  archive: Archiver,
  dirPath: string,
  options?: StreamDirectoryOptions & { baseDir?: string }
): Promise<number> {
  const { baseDir = '', ...streamOpts } = options || {};
  let fileCount = 0;

  try {
    for await (const filePath of streamDirectoryFiles(dirPath, { recursive: true, ...streamOpts })) {
      // Calculate relative path for archive
      const relativePath = path.relative(dirPath, filePath);
      const archivePath = baseDir ? path.join(baseDir, relativePath) : relativePath;

      await pipeStreamToArchive(archive, filePath, { archivePath });
      fileCount++;
    }

    logger.debug(`[pipeDirectoryToArchive] Added ${fileCount} files from ${dirPath}`);
    return fileCount;
  } catch (error) {
    logger.error(`[pipeDirectoryToArchive] Error archiving directory ${dirPath}:`, error);
    throw error;
  }
}

// ============================================================================
// PostgreSQL Native Streaming (pg-query-stream pattern)
// ============================================================================

/**
 * Configuration for PostgreSQL streaming queries
 */
export interface PgStreamConfig {
  /** Batch size for cursor fetch (default: 100) */
  batchSize: number;
  /** Maximum rows to stream (default: unlimited) */
  maxRows?: number;
  /** Query timeout in milliseconds */
  timeout?: number;
}

const DEFAULT_PG_CONFIG: PgStreamConfig = {
  batchSize: 100,
  maxRows: undefined,
  timeout: 30000
};

/**
 * Stream PostgreSQL query results using native cursor-based pagination
 * This is the Node.js equivalent of pg-query-stream, implemented using
 * PostgreSQL's DECLARE CURSOR / FETCH pattern for true streaming.
 * 
 * Memory-efficient: Only holds one batch in memory at a time.
 * Backpressure-aware: Yields control between batches.
 * 
 * @example
 * ```typescript
 * import { Pool } from 'pg';
 * 
 * const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 * 
 * // Stream millions of rows without memory issues
 * const stream = streamPgQuery(
 *   pool,
 *   'SELECT * FROM logs WHERE created_at > $1',
 *   [new Date('2025-01-01')],
 *   { batchSize: 500 }
 * );
 * 
 * for await (const row of stream) {
 *   processRow(row);
 * }
 * ```
 */
export async function* streamPgQuery<T extends Record<string, any>>(
  pool: Pool,
  query: string,
  params: any[] = [],
  config: Partial<PgStreamConfig> = {}
): AsyncGenerator<T, void, unknown> {
  const opts = { ...DEFAULT_PG_CONFIG, ...config };
  const cursorName = `cursor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  
  let client: PoolClient | null = null;
  let totalYielded = 0;
  let batchNumber = 0;

  try {
    // Acquire a dedicated connection for the cursor
    client = await pool.connect();
    
    // Set statement timeout if specified
    if (opts.timeout) {
      await client.query(`SET statement_timeout = ${opts.timeout}`);
    }

    // Begin transaction (required for cursors)
    await client.query('BEGIN');

    // Declare the cursor with the user's query
    const declareQuery = `DECLARE ${cursorName} CURSOR FOR ${query}`;
    await client.query(declareQuery, params);

    logger.debug(`[streamPgQuery] Cursor ${cursorName} declared`);

    // Fetch rows in batches
    while (true) {
      // Check max rows limit
      if (opts.maxRows !== undefined && totalYielded >= opts.maxRows) {
        logger.debug(`[streamPgQuery] Hit maxRows limit: ${opts.maxRows}`);
        break;
      }

      const remainingRows = opts.maxRows !== undefined 
        ? opts.maxRows - totalYielded 
        : opts.batchSize;
      const fetchSize = Math.min(opts.batchSize, remainingRows);

      batchNumber++;
      const fetchQuery = `FETCH ${fetchSize} FROM ${cursorName}`;
      const result = await client.query(fetchQuery);

      if (result.rows.length === 0) {
        logger.debug(`[streamPgQuery] End of results after ${batchNumber} batches, ${totalYielded} rows`);
        break;
      }

      // Yield each row individually for fine-grained control
      for (const row of result.rows) {
        yield row as T;
        totalYielded++;
      }

      // If we got fewer rows than requested, we've reached the end
      if (result.rows.length < fetchSize) {
        logger.debug(`[streamPgQuery] Final batch: ${result.rows.length} rows, total: ${totalYielded}`);
        break;
      }
    }

  } catch (error) {
    logger.error(`[streamPgQuery] Error during streaming:`, error);
    throw error;
  } finally {
    // Clean up: close cursor and release connection
    if (client) {
      try {
        await client.query(`CLOSE ${cursorName}`);
        await client.query('COMMIT');
      } catch (cleanupError) {
        logger.warn(`[streamPgQuery] Cleanup error:`, cleanupError);
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          logger.error(`[streamPgQuery] Rollback error:`, rollbackError);
        }
      } finally {
        client.release();
        logger.debug(`[streamPgQuery] Connection released`);
      }
    }
  }
}

/**
 * Stream a raw SQL query with automatic resource cleanup
 * Simpler API for one-off streaming queries
 * 
 * @example
 * ```typescript
 * const rows = await collectPgStream(
 *   pool,
 *   'SELECT id, name FROM users WHERE active = true',
 *   [],
 *   { batchSize: 1000, maxRows: 10000 }
 * );
 * ```
 */
export async function collectPgStream<T extends Record<string, any>>(
  pool: Pool,
  query: string,
  params: any[] = [],
  config: Partial<PgStreamConfig & { maxItems?: number }> = {}
): Promise<T[]> {
  const { maxItems = 10000, ...streamConfig } = config;
  const stream = streamPgQuery<T>(pool, query, params, { 
    ...streamConfig, 
    maxRows: maxItems 
  });
  return collectStream(stream, maxItems);
}

/**
 * Count rows in a streaming fashion without loading all data
 * Useful for progress indicators on large datasets
 */
export async function countPgStream(
  pool: Pool,
  query: string,
  params: any[] = [],
  config: Partial<PgStreamConfig> = {}
): Promise<number> {
  let count = 0;
  for await (const _ of streamPgQuery(pool, query, params, config)) {
    count++;
  }
  return count;
}

/**
 * Process PostgreSQL results in parallel batches
 * Combines streaming with parallel processing for maximum throughput
 * 
 * @example
 * ```typescript
 * await processPgStreamParallel(
 *   pool,
 *   'SELECT * FROM large_table',
 *   [],
 *   async (batch) => {
 *     await Promise.all(batch.map(row => sendToExternalAPI(row)));
 *   },
 *   { batchSize: 100, parallelism: 5 }
 * );
 * ```
 */
export async function processPgStreamParallel<T extends Record<string, any>>(
  pool: Pool,
  query: string,
  params: any[],
  processor: (batch: T[]) => Promise<void>,
  config: Partial<PgStreamConfig & { parallelism?: number }> = {}
): Promise<{ processed: number; batches: number }> {
  const { parallelism = 3, ...streamConfig } = config;
  const stream = streamPgQuery<T>(pool, query, params, streamConfig);
  const batchedStream = batchStream(stream, streamConfig.batchSize || 100);
  
  let processed = 0;
  let batches = 0;
  const activePromises: Promise<void>[] = [];

  for await (const batch of batchedStream) {
    // Limit parallelism
    if (activePromises.length >= parallelism) {
      await Promise.race(activePromises);
    }

    const promise = processor(batch as T[]).then(() => {
      const index = activePromises.indexOf(promise);
      if (index > -1) activePromises.splice(index, 1);
    });

    activePromises.push(promise);
    processed += batch.length;
    batches++;
  }

  // Wait for remaining promises
  await Promise.all(activePromises);
  
  logger.debug(`[processPgStreamParallel] Completed: ${processed} rows in ${batches} batches`);
  return { processed, batches };
}
