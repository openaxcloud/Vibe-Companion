/**
 * AI Router for E-Code Platform
 * Handles AI-powered code completion, explanation, conversion, and documentation
 */

import { Router } from 'express';
import {
  generateCompletion,
  generateExplanation,
  convertCode,
  generateDocumentation,
  generateTests,
  handleCodeActions,
  handleCodeActionsStream,
  generateProjectChat,
  getProjectHistory,
  generateProjectSuggestions,
  generateAI,
  generateOpenAI,
  generateOpenSource
} from '../ai';
import { ensureAuthenticated } from '../middleware/auth';

const router = Router();

// GET /api/ai/features — AI features metadata for the marketing page (public, no auth)
router.get('/features', (_req, res) => {
  res.json({
    features: {
      autonomous: {
        title: 'Autonomous Agent',
        description: 'AI that plans, codes, and deploys full applications independently with multi-step reasoning.',
        icon: 'Brain',
        details: [
          'Multi-step task planning and execution',
          'Automatic error detection and self-correction',
          'Parallel task decomposition for faster delivery',
          'Full application scaffolding from a single prompt'
        ]
      },
      multilingual: {
        title: '28+ Languages',
        description: 'Expert-level support for Python, TypeScript, Rust, Go, Java, C++, and 22 more languages.',
        icon: 'Languages',
        details: [
          'Real-time syntax highlighting and IntelliSense',
          'Language-specific best practices and patterns',
          'Cross-language refactoring and migration',
          'Framework-aware code generation'
        ]
      },
      intelligent: {
        title: 'Intelligent Context',
        description: 'Understands your entire codebase — files, dependencies, Git history — to generate precise code.',
        icon: 'Sparkles',
        details: [
          'Repository-wide context awareness (1M token window)',
          'Dependency graph analysis',
          'Git history for informed suggestions',
          'Memory bank for persistent project knowledge'
        ]
      },
      realtime: {
        title: 'Real-Time Streaming',
        description: 'See code appear instantly via SSE streaming. No waiting — your AI works at the speed of thought.',
        icon: 'Zap',
        details: [
          'Token-by-token SSE streaming output',
          'Live preview auto-refresh',
          'Incremental file edits (no full rewrites)',
          'WebSocket-based collaborative editing'
        ]
      }
    },
    useCases: [
      {
        title: 'Full-Stack Applications',
        description: 'Build complete web apps with React, Node.js, and PostgreSQL from a single prompt.',
        icon: 'Globe',
        example: '"Create a SaaS dashboard with authentication and Stripe billing"'
      },
      {
        title: 'API Development',
        description: 'Generate REST or GraphQL APIs with validation, auth, and OpenAPI docs automatically.',
        icon: 'Code2',
        example: '"Build a REST API with JWT auth, rate limiting, and Swagger docs"'
      },
      {
        title: 'AI-Powered Testing',
        description: 'Auto-generate unit, integration, and E2E test suites with full coverage reports.',
        icon: 'Shield',
        example: '"Generate Playwright E2E tests for my checkout flow"'
      },
      {
        title: 'Code Review & Refactor',
        description: 'Deep code analysis with security scanning, performance profiling, and refactoring suggestions.',
        icon: 'Search',
        example: '"Review my authentication module for security vulnerabilities"'
      }
    ],
    aiTools: [
      { name: 'Autonomous Agent', icon: 'Brain', description: 'Fully autonomous multi-step task execution' },
      { name: 'Code Completion', icon: 'Code2', description: 'Context-aware inline completions in the editor' },
      { name: 'Inline Actions', icon: 'Zap', description: 'Explain, debug, test, optimize with one click' },
      { name: 'Voice Vibe Coding', icon: 'Mic', description: 'Speak your idea — AI writes the code' },
      { name: 'Memory Bank', icon: 'Database', description: 'Persistent project context across sessions' },
      { name: 'Checkpoint & Rollback', icon: 'History', description: 'Atomic snapshots at every AI step' }
    ],
    providers: [
      { name: 'OpenAI', models: ['GPT-4o', 'GPT-4o Mini', 'o1', 'o3'], available: !!process.env.OPENAI_API_KEY },
      { name: 'Anthropic', models: ['Claude Opus 4', 'Claude 3.5 Sonnet', 'Claude 3.5 Haiku'], available: !!process.env.ANTHROPIC_API_KEY },
      { name: 'Google Gemini', models: ['Gemini 2.5 Flash', 'Gemini 2.0 Flash', 'Gemini 1.5 Pro'], available: !!process.env.GEMINI_API_KEY },
      { name: 'xAI', models: ['Grok 2'], available: !!process.env.XAI_API_KEY },
      { name: 'Moonshot (Kimi)', models: ['Kimi K2 Thinking', 'Kimi K2 Turbo'], available: !!process.env.MOONSHOT_API_KEY }
    ]
  });
});

// GET /api/openai/models — OpenAI-specific model list (public, used by OpenAIModelSelector)
router.get('/openai/models', (_req, res) => {
  res.json([
    { id: 'gpt-4.1', name: 'GPT-4.1', capabilities: ['chat', 'vision', 'function_calling', 'code_interpreter'], contextWindow: 1000000, maxOutput: 32768 },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', capabilities: ['chat', 'function_calling'], contextWindow: 1000000, maxOutput: 16384 },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', capabilities: ['chat', 'function_calling'], contextWindow: 1000000, maxOutput: 8192 },
    { id: 'gpt-4o', name: 'GPT-4o', capabilities: ['chat', 'vision', 'function_calling', 'code_interpreter'], contextWindow: 128000, maxOutput: 4096 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', capabilities: ['chat', 'function_calling'], contextWindow: 128000, maxOutput: 16000 },
    { id: 'o4-mini', name: 'o4-mini', capabilities: ['chat', 'reasoning', 'complex_analysis'], contextWindow: 200000, maxOutput: 100000 },
    { id: 'o3', name: 'o3', capabilities: ['chat', 'reasoning', 'complex_analysis'], contextWindow: 200000, maxOutput: 100000 },
    { id: 'o3-mini', name: 'o3-mini', capabilities: ['chat', 'reasoning'], contextWindow: 200000, maxOutput: 65536 }
  ]);
});

// GET /api/opensource/models — open-source model list (public, used by AllModelsSelector)
router.get('/opensource/models', (_req, res) => {
  res.json([
    { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', provider: 'meta', contextWindow: 128000, license: 'open' },
    { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', provider: 'meta', contextWindow: 128000, license: 'open' },
    { id: 'mistral-7b', name: 'Mistral 7B', provider: 'mistral', contextWindow: 32768, license: 'open' },
    { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', provider: 'mistral', contextWindow: 32768, license: 'open' },
    { id: 'codestral', name: 'Codestral', provider: 'mistral', contextWindow: 32768, license: 'open' },
    { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', provider: 'deepseek', contextWindow: 128000, license: 'open' },
    { id: 'phi-3-medium', name: 'Phi-3 Medium', provider: 'microsoft', contextWindow: 128000, license: 'open' },
    { id: 'qwen2.5-72b', name: 'Qwen 2.5 72B', provider: 'alibaba', contextWindow: 131072, license: 'open' }
  ]);
});

// POST /api/ai/* — authenticated AI generation endpoints (specific paths before wildcards)
router.post('/completion', ensureAuthenticated, generateCompletion);
router.post('/explanation', ensureAuthenticated, generateExplanation);
router.post('/convert', ensureAuthenticated, convertCode);
router.post('/documentation', ensureAuthenticated, generateDocumentation);
router.post('/tests', ensureAuthenticated, generateTests);

// Inline Code Actions (Right-click + Lightbulb)
router.post('/code-actions', ensureAuthenticated, handleCodeActions);
router.post('/code-actions/stream', ensureAuthenticated, handleCodeActionsStream);

// POST /api/ai/generate — general AI generation (all providers: Claude, Gemini, xAI, Kimi)
// Also accessible as /api/generate via dual-mount at /api
router.post('/generate', ensureAuthenticated, generateAI);

// POST /api/openai/generate — OpenAI-specific generation (used by AllModelsSelector for GPT/o1/o3)
// Also accessible as /api/ai/openai/generate via dual-mount
router.post('/openai/generate', ensureAuthenticated, generateOpenAI);

// POST /api/opensource/generate — open-source model generation (AllModelsSelector fallback)
router.post('/opensource/generate', ensureAuthenticated, generateOpenSource);

// POST /api/ai/feedback — submit feedback on an AI response (used by AIAssistant)
router.post('/feedback', ensureAuthenticated, (_req, res) => {
  res.json({ success: true, message: 'Feedback recorded' });
});

// --- Project-specific routes (MUST come AFTER all fixed-path routes) ---
// POST /api/ai/:projectId/chat — project-specific AI chat (ReplitAssistant, AIAssistant)
router.post('/:projectId/chat', ensureAuthenticated, generateProjectChat);

// GET /api/ai/:projectId/history — project chat history (AIAssistant)
router.get('/:projectId/history', ensureAuthenticated, getProjectHistory);

// POST /api/ai/:projectId/suggestions — AI code suggestions (AIAssistant)
router.post('/:projectId/suggestions', ensureAuthenticated, generateProjectSuggestions);

export default router;
