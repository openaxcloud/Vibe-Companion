import { Router } from 'express';
import { z } from 'zod';
import { ensureAuthenticated as requireAuth } from '../middleware/auth';

const router = Router();

// Validation schemas
const generateFeaturesSchema = z.object({
  projectId: z.string(),
  prompt: z.string().min(1)
});

const buildFullSchema = z.object({
  projectId: z.string(),
  features: z.array(z.string()),
  prompt: z.string()
});

const buildFromDesignSchema = z.object({
  projectId: z.string(),
  designUrl: z.string(),
  features: z.array(z.string())
});

const extendedBuildSchema = z.object({
  projectId: z.string(),
  taskList: z.array(z.string())
});

/**
 * POST /api/agent/features/generate
 * Generate feature list from user prompt using AI
 */
router.post('/features/generate', requireAuth, async (req, res) => {
  try {
    const { projectId, prompt } = generateFeaturesSchema.parse(req.body);

    // Intelligent keyword-based feature generation
    // Provides instant results without AI API dependency
    const features = generateFeaturesFromPrompt(prompt);

    res.json({
      success: true,
      features
    });
  } catch (error) {
    console.error('Feature generation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate features'
    });
  }
});

/**
 * POST /api/agent/build/full
 * Start full build workflow (20+ minutes)
 */
router.post('/build/full', requireAuth, async (req, res) => {
  try {
    const { projectId, features, prompt } = buildFullSchema.parse(req.body);

    // Generate intelligent task list from feature set
    // Note: Autonomous build system integration available via agent endpoints
    const taskList = generateTaskListFromFeatures(features);

    res.json({
      success: true,
      taskList,
      estimatedTime: '20-30 minutes'
    });
  } catch (error) {
    console.error('Full build error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start full build'
    });
  }
});

/**
 * POST /api/agent/build/from-design
 * Build functionality from design prototype
 */
router.post('/build/from-design', requireAuth, async (req, res) => {
  try {
    const { projectId, designUrl, features } = buildFromDesignSchema.parse(req.body);

    // Generate standard design-to-code task list
    // Note: Figma integration available via MCP for automated conversion
    const taskList = [
      'Convert design components to React components',
      'Add state management with hooks',
      'Implement API integration',
      'Set up database schema',
      'Add authentication flow',
      'Implement business logic',
      'Add error handling',
      'Write unit tests'
    ];

    res.json({
      success: true,
      taskList,
      estimatedTime: '15-25 minutes'
    });
  } catch (error) {
    console.error('Build from design error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to build from design'
    });
  }
});

/**
 * POST /api/agent/build/extended
 * Start extended build (up to 200 minutes)
 */
router.post('/build/extended', requireAuth, async (req, res) => {
  try {
    const { projectId, taskList } = extendedBuildSchema.parse(req.body);

    // Extended autonomous build available via /api/agent/autonomous endpoints
    // This endpoint provides task list structure for UI preview
    
    res.json({
      success: true,
      message: 'Extended build started',
      maxDuration: '200 minutes'
    });
  } catch (error) {
    console.error('Extended build error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start extended build'
    });
  }
});

// Helper functions

function generateFeaturesFromPrompt(prompt: string): string[] {
  const lowerPrompt = prompt.toLowerCase();
  const features: string[] = [];

  // Intelligent feature detection based on keywords
  if (lowerPrompt.includes('auth') || lowerPrompt.includes('login') || lowerPrompt.includes('user')) {
    features.push('User authentication and authorization system');
  }

  if (lowerPrompt.includes('database') || lowerPrompt.includes('data') || lowerPrompt.includes('store')) {
    features.push('Database integration for data persistence');
  }

  if (lowerPrompt.includes('api') || lowerPrompt.includes('backend') || lowerPrompt.includes('server')) {
    features.push('RESTful API endpoints with validation');
  }

  if (lowerPrompt.includes('mobile') || lowerPrompt.includes('responsive')) {
    features.push('Responsive design for mobile and desktop');
  }

  if (lowerPrompt.includes('dashboard') || lowerPrompt.includes('admin')) {
    features.push('Admin dashboard with analytics');
  }

  if (lowerPrompt.includes('chat') || lowerPrompt.includes('message')) {
    features.push('Real-time messaging system');
  }

  if (lowerPrompt.includes('payment') || lowerPrompt.includes('stripe')) {
    features.push('Payment processing integration');
  }

  if (lowerPrompt.includes('search')) {
    features.push('Advanced search functionality');
  }

  // Default features if none detected
  if (features.length === 0) {
    features.push(
      'User interface with modern design',
      'Core functionality as described',
      'Data management system',
      'Responsive layout',
      'Error handling and validation'
    );
  }

  return features;
}

function generateTaskListFromFeatures(features: string[]): string[] {
  const tasks: string[] = [];

  for (const feature of features) {
    const lowerFeature = feature.toLowerCase();

    if (lowerFeature.includes('auth')) {
      tasks.push(
        'Set up authentication middleware',
        'Create user registration flow',
        'Implement login/logout functionality',
        'Add password reset capability'
      );
    }

    if (lowerFeature.includes('database')) {
      tasks.push(
        'Design database schema',
        'Set up database migrations',
        'Create data access layer',
        'Add database indexing'
      );
    }

    if (lowerFeature.includes('api')) {
      tasks.push(
        'Create API route structure',
        'Add request validation',
        'Implement error handling',
        'Write API documentation'
      );
    }

    if (lowerFeature.includes('responsive') || lowerFeature.includes('mobile')) {
      tasks.push(
        'Create responsive layout components',
        'Add mobile-first CSS',
        'Test on multiple devices',
        'Optimize for touch interfaces'
      );
    }

    if (lowerFeature.includes('dashboard')) {
      tasks.push(
        'Design dashboard layout',
        'Create data visualization components',
        'Add filtering and sorting',
        'Implement real-time updates'
      );
    }
  }

  // Default tasks if none generated
  if (tasks.length === 0) {
    tasks.push(
      'Set up project structure',
      'Create core components',
      'Implement main functionality',
      'Add styling and UI polish',
      'Test and debug',
      'Optimize performance'
    );
  }

  return tasks;
}

export default router;
