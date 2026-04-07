/**
 * Placeholder Image Router
 * 
 * Generates dynamic placeholder images and avatars like Replit.
 * Supports:
 * - /api/placeholder/:width/:height - Generic placeholder
 * - /api/placeholder/:widthxheight - Alternative format
 * - /api/avatar/:name - Generate avatar with initials
 * - /api/avatar/:name/:size - Generate sized avatar
 * 
 * Fortune 500 Quality: Production-ready SVG generation
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

const router = Router();

// SECURITY FIX #22: Add rate limiting to prevent DoS attacks
const placeholderRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

// In-memory SVG cache to prevent regeneration on every request
const svgCache = new Map<string, { svg: string; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache TTL
const MAX_CACHE_SIZE = 1000;

function getCachedSvg(key: string): string | null {
  const cached = svgCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.svg;
  }
  if (cached) {
    svgCache.delete(key);
  }
  return null;
}

function setCachedSvg(key: string, svg: string): void {
  if (svgCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = svgCache.keys().next().value;
    if (oldestKey) svgCache.delete(oldestKey);
  }
  svgCache.set(key, { svg, timestamp: Date.now() });
}

// Color palette for avatars (Replit-inspired)
const AVATAR_COLORS = [
  { bg: '#F26207', fg: '#FFFFFF' }, // Orange (primary)
  { bg: '#3B82F6', fg: '#FFFFFF' }, // Blue
  { bg: '#10B981', fg: '#FFFFFF' }, // Green
  { bg: '#8B5CF6', fg: '#FFFFFF' }, // Purple
  { bg: '#EC4899', fg: '#FFFFFF' }, // Pink
  { bg: '#F59E0B', fg: '#FFFFFF' }, // Amber
  { bg: '#06B6D4', fg: '#FFFFFF' }, // Cyan
  { bg: '#EF4444', fg: '#FFFFFF' }, // Red
  { bg: '#6366F1', fg: '#FFFFFF' }, // Indigo
  { bg: '#14B8A6', fg: '#FFFFFF' }, // Teal
];

// Get consistent color based on string hash
function getColorFromString(str: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Get initials from name
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Generate SVG avatar
function generateAvatarSVG(name: string, size: number): string {
  const { bg, fg } = getColorFromString(name);
  const initials = getInitials(name);
  const fontSize = Math.floor(size * 0.4);
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.1}" fill="${bg}"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" 
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        font-size="${fontSize}" font-weight="600" fill="${fg}">${initials}</text>
</svg>`;
}

// Generate placeholder image SVG
function generatePlaceholderSVG(width: number, height: number, text?: string): string {
  const displayText = text || `${width}×${height}`;
  const fontSize = Math.min(width, height) * 0.1;
  const bgColor = '#1E1E1E';
  const fgColor = '#6B7280';
  const gridColor = '#2D2D2D';
  
  // Create a modern grid pattern
  const gridSize = Math.max(width, height) * 0.05;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="grid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
      <path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="${gridColor}" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="${bgColor}"/>
  <rect width="${width}" height="${height}" fill="url(#grid)"/>
  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" fill="none" stroke="${gridColor}" stroke-width="1" rx="4"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" 
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Consolas, monospace" 
        font-size="${fontSize}" font-weight="500" fill="${fgColor}">${displayText}</text>
</svg>`;
}

// Generate product image placeholder
function generateProductSVG(width: number, height: number): string {
  const iconSize = Math.min(width, height) * 0.3;
  const iconX = (width - iconSize) / 2;
  const iconY = (height - iconSize) / 2 - height * 0.05;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <g transform="translate(${iconX}, ${iconY})">
    <rect width="${iconSize}" height="${iconSize * 0.7}" rx="${iconSize * 0.1}" fill="#3B82F6" opacity="0.2"/>
    <rect x="${iconSize * 0.1}" y="${iconSize * 0.15}" width="${iconSize * 0.35}" height="${iconSize * 0.4}" rx="${iconSize * 0.05}" fill="#3B82F6" opacity="0.4"/>
    <rect x="${iconSize * 0.55}" y="${iconSize * 0.15}" width="${iconSize * 0.35}" height="${iconSize * 0.4}" rx="${iconSize * 0.05}" fill="#3B82F6" opacity="0.6"/>
    <circle cx="${iconSize * 0.5}" cy="${iconSize * 0.85}" r="${iconSize * 0.08}" fill="#6B7280"/>
  </g>
  <text x="50%" y="${height * 0.85}" dominant-baseline="central" text-anchor="middle" 
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        font-size="${Math.min(width, height) * 0.08}" font-weight="400" fill="#6B7280">Product Image</text>
</svg>`;
}

// Avatar endpoint: /api/avatar/:name or /api/avatar/:name/:size
// SECURITY FIX #22: Apply rate limiting
router.get('/avatar/:name{/:size}', placeholderRateLimiter, (req: Request, res: Response) => {
  const name = decodeURIComponent(req.params.name || 'User');
  const size = parseInt(req.params.size || '100', 10);
  
  // Validate size
  const clampedSize = Math.max(16, Math.min(512, size));
  
  // SECURITY FIX #22: Check cache first
  const cacheKey = `avatar:${name}:${clampedSize}`;
  let svg = getCachedSvg(cacheKey);
  
  if (!svg) {
    svg = generateAvatarSVG(name, clampedSize);
    setCachedSvg(cacheKey, svg);
  }
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(svg);
});

// Placeholder endpoint: /api/placeholder/:width/:height
// SECURITY FIX #22: Apply rate limiting
router.get('/placeholder/:width/:height', placeholderRateLimiter, (req: Request, res: Response) => {
  const width = parseInt(req.params.width, 10) || 200;
  const height = parseInt(req.params.height, 10) || 200;
  const text = req.query.text as string | undefined;
  const type = req.query.type as string | undefined;
  
  // Clamp dimensions
  const clampedWidth = Math.max(16, Math.min(2000, width));
  const clampedHeight = Math.max(16, Math.min(2000, height));
  
  // SECURITY FIX #22: Check cache first
  const cacheKey = `placeholder:${clampedWidth}:${clampedHeight}:${type || 'default'}:${text || ''}`;
  let svg = getCachedSvg(cacheKey);
  
  if (!svg) {
    if (type === 'product') {
      svg = generateProductSVG(clampedWidth, clampedHeight);
    } else {
      svg = generatePlaceholderSVG(clampedWidth, clampedHeight, text);
    }
    setCachedSvg(cacheKey, svg);
  }
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

// Alternative format: /api/placeholder/:dimensions (e.g., 300x200)
// SECURITY FIX #22: Apply rate limiting
router.get('/placeholder/:dimensions', placeholderRateLimiter, (req: Request, res: Response) => {
  const dimensions = req.params.dimensions;
  const match = dimensions.match(/^(\d+)x(\d+)$/i);
  
  if (!match) {
    return res.status(400).json({ 
      error: 'Invalid dimensions format. Use WIDTHxHEIGHT (e.g., 300x200)' 
    });
  }
  
  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);
  const type = req.query.type as string | undefined;
  
  // Clamp dimensions
  const clampedWidth = Math.max(16, Math.min(2000, width));
  const clampedHeight = Math.max(16, Math.min(2000, height));
  
  // SECURITY FIX #22: Check cache first
  const cacheKey = `placeholder:${clampedWidth}:${clampedHeight}:${type || 'default'}`;
  let svg = getCachedSvg(cacheKey);
  
  if (!svg) {
    if (type === 'product') {
      svg = generateProductSVG(clampedWidth, clampedHeight);
    } else {
      svg = generatePlaceholderSVG(clampedWidth, clampedHeight);
    }
    setCachedSvg(cacheKey, svg);
  }
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

export default router;
