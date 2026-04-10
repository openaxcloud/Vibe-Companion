/**
 * Type Conversion Utilities
 * Centralized type normalization for consistent data handling across backend
 */

/**
 * Normalize projectId to number type (canonical database format)
 * Handles string, number, undefined, and null inputs safely
 * @param projectId The project ID in any format
 * @returns number or undefined if invalid
 */
export function normalizeProjectId(projectId: string | number | undefined | null): number | undefined {
  if (projectId === undefined || projectId === null) {
    return undefined;
  }
  
  if (typeof projectId === 'number') {
    return isNaN(projectId) ? undefined : projectId;
  }
  
  if (typeof projectId === 'string') {
    const parsed = parseInt(projectId, 10);
    return isNaN(parsed) ? undefined : parsed;
  }
  
  return undefined;
}

/**
 * Normalize projectId to number type, throwing error if invalid
 * Use when projectId is required and must be valid
 * @param projectId The project ID in any format
 * @returns number (throws if invalid)
 */
export function requireProjectId(projectId: string | number | undefined | null): number {
  const normalized = normalizeProjectId(projectId);
  if (normalized === undefined) {
    throw new Error(`Invalid projectId: ${projectId}`);
  }
  return normalized;
}

/**
 * Type guard to check if projectId is valid
 * @param projectId The project ID to check
 * @returns boolean indicating validity
 */
export function isValidProjectId(projectId: string | number | undefined | null): projectId is string | number {
  return normalizeProjectId(projectId) !== undefined;
}

/**
 * Convert projectId to string for URL/API usage
 * @param projectId The project ID in any format
 * @returns string representation or empty string if invalid
 */
export function projectIdToString(projectId: string | number | undefined | null): string {
  const normalized = normalizeProjectId(projectId);
  return normalized !== undefined ? String(normalized) : '';
}

/**
 * Normalize userId to number type (canonical database format)
 * @param userId The user ID in any format
 * @returns number or undefined if invalid
 */
export function normalizeUserId(userId: string | number | undefined | null): number | undefined {
  return normalizeProjectId(userId); // Same logic applies
}

/**
 * Normalize userId to number type, throwing error if invalid
 * @param userId The user ID in any format
 * @returns number (throws if invalid)
 */
export function requireUserId(userId: string | number | undefined | null): number {
  const normalized = normalizeUserId(userId);
  if (normalized === undefined) {
    throw new Error(`Invalid userId: ${userId}`);
  }
  return normalized;
}

/**
 * Normalize conversationId to number type
 * @param conversationId The conversation ID in any format
 * @returns number or undefined if invalid
 */
export function normalizeConversationId(conversationId: string | number | undefined | null): number | undefined {
  return normalizeProjectId(conversationId); // Same logic applies
}

/**
 * Normalize fileId to number type
 * @param fileId The file ID in any format
 * @returns number or undefined if invalid
 */
export function normalizeFileId(fileId: string | number | undefined | null): number | undefined {
  return normalizeProjectId(fileId); // Same logic applies
}

/**
 * Safe parseInt with fallback
 * @param value Value to parse
 * @param fallback Fallback value if parsing fails
 * @returns Parsed number or fallback
 */
export function safeParseInt(value: string | number | undefined | null, fallback: number = 0): number {
  const normalized = normalizeProjectId(value);
  return normalized ?? fallback;
}
