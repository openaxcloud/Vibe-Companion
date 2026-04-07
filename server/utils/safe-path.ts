import path from 'path';

/**
 * Safely resolve a path within a base directory, preventing path traversal attacks.
 * 
 * @param basePath - The base directory that the resolved path must be within
 * @param userPath - The user-provided path to resolve
 * @returns The resolved absolute path if safe, or null if a traversal attempt is detected
 * 
 * @example
 * safePath('/projects', 'myfile.txt') // Returns '/projects/myfile.txt'
 * safePath('/projects', '../etc/passwd') // Returns null (traversal detected)
 * safePath('/projects', 'subdir/../file.txt') // Returns '/projects/file.txt' (normalized)
 */
export function safePath(basePath: string, userPath: string): string | null {
  const resolvedBase = path.resolve(basePath);
  const resolved = path.resolve(basePath, userPath);
  
  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
    return null; // Traversal attempt detected
  }
  
  return resolved;
}
