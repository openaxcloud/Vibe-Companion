import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get user initials from name
 * @param name User name
 * @returns Initials (maximum 2 characters)
 */
export function getInitials(name: string): string {
  if (!name) return '';
  
  const parts = name.split(/[ -]/);
  
  if (parts.length === 1) {
    return name.substring(0, 2).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Generate a deterministic color for user avatar based on input
 * @param input String to base color on (e.g., username or user ID)
 * @returns Color as hex string
 */
export function getRandomColor(input?: string): string {
  // Predefined color palette for better visibility against white text
  const colors = [
    '#D32F2F', // Red
    '#7B1FA2', // Purple
    '#1976D2', // Blue
    '#0097A7', // Cyan
    '#388E3C', // Green
    '#FBC02D', // Yellow
    '#F57C00', // Orange
    '#5D4037', // Brown
    '#455A64', // Blue Grey
    '#616161', // Grey
  ];
  
  // If no input provided, use current timestamp for deterministic but changing color
  const seed = input || new Date().toISOString();
  
  // Generate hash from input for deterministic selection
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Format bytes to human-readable string
 * @param bytes Number of bytes
 * @returns Formatted string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Build the canonical workspace URL for a project.
 * Falls back to ID-based routing when the slug or username is unavailable.
 */
interface ProjectOwnerLike {
  username?: string | null;
}

interface ProjectLike {
  slug?: string | null;
  projectSlug?: string | null;
  owner?: ProjectOwnerLike | null;
  ownerUsername?: string | null;
  owner_name?: string | null;
  id?: number | string | null;
  projectId?: number | string | null;
}

export function getProjectUrl(project: ProjectLike, fallbackUsername?: string | null): string {
  if (!project) {
    return '/projects';
  }

  // ALWAYS use /ide/:id route for consistent workspace experience with Add Tab dropdown
  // This ensures all navigation paths (cards, play, edit, slugs) land on the new IDE
  const projectId = project.id ?? project.projectId ?? null;
  if (projectId) {
    return `/ide/${projectId}`;
  }
  
  // Legacy slug support: redirect through canonical route
  // Slugs are preserved for sharing but now resolve to /ide/:id for UX consistency
  const slug = project.slug ?? project.projectSlug ?? null;
  const ownerUsername =
    project.owner?.username ??
    project.ownerUsername ??
    project.owner_name ??
    fallbackUsername ??
    null;

  if (slug && ownerUsername) {
    // Note: /@username/slug URLs still work but resolve to /ide/:id via ProjectPage redirect
    return `/@${ownerUsername}/${slug}`;
  }

  return '/projects';
}

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
