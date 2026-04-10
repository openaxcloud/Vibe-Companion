import { Router } from 'express';
import { createLogger } from '../utils/logger';
import { ensureAuthenticated } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const logger = createLogger('global-themes');

// Validation schemas
const themeSettingsSchema = z.object({
  activeEditorTheme: z.string().optional(),
  systemTheme: z.enum(['dark', 'light', 'midnight']).optional(),
  customSettings: z.object({
    fontSize: z.string().optional(),
    lineHeight: z.string().optional(),
    tabSize: z.string().optional(),
    wordWrap: z.enum(['on', 'off', 'wordWrapColumn', 'bounded']).optional()
  }).optional()
});

const themeIdSchema = z.object({
  themeId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_]+$/, 'Invalid theme ID format')
});

const createThemeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  preview: z.object({
    bg: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    fg: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
  }).optional()
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

const editorThemes = [
  {
    id: 'dark-pro',
    name: 'Dark Pro',
    description: 'A professional dark theme with high contrast',
    author: 'E-Code Team',
    official: true,
    preview: { bg: '#1e1e1e', fg: '#d4d4d4', accent: '#569cd6' },
    downloads: 125000,
    rating: 4.9
  },
  {
    id: 'monokai',
    name: 'Monokai',
    description: 'Classic Monokai color scheme',
    author: 'E-Code Team',
    official: true,
    preview: { bg: '#272822', fg: '#f8f8f2', accent: '#f92672' },
    downloads: 98000,
    rating: 4.8
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    description: 'Inspired by Atom\'s One Dark theme',
    author: 'Community',
    official: false,
    preview: { bg: '#282c34', fg: '#abb2bf', accent: '#61afef' },
    downloads: 75000,
    rating: 4.7
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    description: 'Light theme inspired by GitHub',
    author: 'E-Code Team',
    official: true,
    preview: { bg: '#ffffff', fg: '#24292e', accent: '#0366d6' },
    downloads: 45000,
    rating: 4.6
  }
];

const uiThemes = [
  {
    id: 'dark',
    name: 'Dark Mode',
    description: 'Reduce eye strain with a dark interface',
    preview: { bg: '#0d1117', surface: '#161b22', primary: '#238636' }
  },
  {
    id: 'light',
    name: 'Light Mode',
    description: 'Classic light interface',
    preview: { bg: '#ffffff', surface: '#f6f8fa', primary: '#0969da' }
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    description: 'Deep blue tones for night coding',
    preview: { bg: '#0a192f', surface: '#112240', primary: '#64ffda' }
  }
];

router.get('/', (req, res) => {
  res.json({
    editor: editorThemes,
    ui: uiThemes,
    includes: ['dark-pro', 'one-dark']
  });
});

router.get('/settings', (req, res) => {
  res.json({
    activeEditorTheme: 'dark-pro',
    systemTheme: 'dark',
    customSettings: {
      fontSize: '14px',
      lineHeight: '1.5',
      tabSize: '2',
      wordWrap: 'on'
    }
  });
});

router.get('/installed', (req, res) => {
  const parseResult = paginationQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid query parameters', details: parseResult.error.issues });
  }

  const { page, limit } = parseResult.data;
  const installedThemes = ['dark-pro', 'one-dark', 'monokai'];
  const total = installedThemes.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  // Validate page number
  if (page > totalPages && total > 0) {
    return res.status(400).json({ error: 'Page number exceeds total pages' });
  }

  const items = installedThemes.slice(offset, offset + limit);

  res.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  });
});

router.put('/settings', ensureAuthenticated, (req, res) => {
  const parseResult = themeSettingsSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid settings', details: parseResult.error.issues });
  }
  
  logger.info('Theme settings updated', { body: parseResult.data, userId: (req.user as any)?.id });
  res.json({
    ...parseResult.data,
    updatedAt: new Date().toISOString()
  });
});

router.post('/install', ensureAuthenticated, (req, res) => {
  const parseResult = themeIdSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid theme ID', details: parseResult.error.issues });
  }
  
  const { themeId } = parseResult.data;
  logger.info('Theme installed', { themeId, userId: (req.user as any)?.id });
  res.json({ success: true, themeId, installedAt: new Date().toISOString() });
});

router.post('/create', ensureAuthenticated, (req, res) => {
  const parseResult = createThemeSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid theme data', details: parseResult.error.issues });
  }
  
  const theme = parseResult.data;
  logger.info('Custom theme created', { theme, userId: (req.user as any)?.id });
  res.json({ 
    id: `custom-${Date.now()}`,
    ...theme,
    createdAt: new Date().toISOString()
  });
});

router.get('/export', ensureAuthenticated, (req, res) => {
  const settings = {
    activeEditorTheme: 'dark-pro',
    systemTheme: 'dark',
    customSettings: {
      fontSize: '14px',
      lineHeight: '1.5',
      tabSize: '2',
      wordWrap: 'on'
    },
    exportedAt: new Date().toISOString()
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=ecode-theme-settings.json');
  res.json(settings);
});

router.post('/import', ensureAuthenticated, (req, res) => {
  const parseResult = themeSettingsSchema.safeParse(req.body?.settings);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid settings format', details: parseResult.error.issues });
  }
  
  logger.info('Theme settings imported', { settings: parseResult.data, userId: (req.user as any)?.id });
  res.json({ success: true, importedAt: new Date().toISOString() });
});

export default router;
