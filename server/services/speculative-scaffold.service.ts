/**
 * Speculative Scaffold Service - Enhanced for Complete App Generation
 * 
 * Creates COMPLETE, RUNNABLE project structures with real code.
 * This is the key service for generating full apps from prompts.
 * 
 * Phase 1 (Fast - parallel with AI): Basic structure + configs
 * Phase 2 (After plan): Full code generation with working entry points
 * 
 * The scaffolding creates:
 * - Complete directory structure
 * - Full package.json with REAL dependencies
 * - Working entry point files (App.tsx, index.tsx, etc.)
 * - All config files (vite, tsconfig, tailwind, etc.)
 * - Basic UI components ready to customize
 * 
 * @author E-Code Platform
 * @version 2.0.0 - Enhanced for 100% Replit Parity
 * @since December 2025
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('speculative-scaffold');

export interface ScaffoldOptions {
  projectId: string;
  language?: string;
  framework?: string;
  prompt?: string;
  projectName?: string;
  includeDatabase?: boolean;
  includeTailwind?: boolean;
  includeAuth?: boolean;
}

export interface ScaffoldResult {
  success: boolean;
  filesCreated: string[];
  durationMs: number;
  framework: string;
  dependencies: string[];
  devDependencies: string[];
  error?: string;
}

export interface ScaffoldProgressEvent {
  type: 'start' | 'directory' | 'file' | 'complete' | 'error';
  message: string;
  progress: number;
  filePath?: string;
}

// ============================================
// COMPLETE FRAMEWORK TEMPLATES WITH REAL CODE
// These generate RUNNABLE apps, not skeletons
// ============================================

const FRAMEWORK_TEMPLATES: Record<string, {
  directories: string[];
  files: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}> = {
  'react-vite-fullstack': {
    directories: [
      'client/src',
      'client/src/components',
      'client/src/components/ui',
      'client/src/hooks',
      'client/src/lib',
      'client/src/pages',
      'client/public',
      'server',
      'server/routes',
      'shared'
    ],
    files: {
      'package.json': JSON.stringify({
        name: 'fullstack-app',
        version: '1.0.0',
        type: 'module',
        scripts: {
          dev: 'concurrently "npm run dev:server" "npm run dev:client"',
          'dev:server': 'tsx watch server/index.ts',
          'dev:client': 'vite',
          build: 'vite build && tsc -p tsconfig.server.json',
          start: 'node dist/server/index.js',
          preview: 'vite preview'
        },
        dependencies: {
          'react': '^18.2.0',
          'react-dom': '^18.2.0',
          'express': '^4.18.2',
          'cors': '^2.8.5',
          'wouter': '^3.0.0',
          '@tanstack/react-query': '^5.0.0',
          'lucide-react': '^0.300.0',
          'clsx': '^2.0.0',
          'tailwind-merge': '^2.0.0'
        },
        devDependencies: {
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          '@types/express': '^4.17.21',
          '@types/cors': '^2.8.17',
          '@types/node': '^20.0.0',
          '@vitejs/plugin-react': '^4.2.0',
          'autoprefixer': '^10.4.16',
          'concurrently': '^8.2.2',
          'postcss': '^8.4.32',
          'tailwindcss': '^3.4.0',
          'tsx': '^4.7.0',
          'typescript': '^5.3.0',
          'vite': '^5.0.0'
        }
      }, null, 2),
      'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../dist/client'
  }
});`,
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
          baseUrl: '.',
          paths: {
            '@/*': ['client/src/*'],
            '@shared/*': ['shared/*']
          }
        },
        include: ['client/src', 'shared']
      }, null, 2),
      'tsconfig.server.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'bundler',
          outDir: './dist/server',
          rootDir: './server',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true
        },
        include: ['server/**/*']
      }, null, 2),
      'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./client/index.html', './client/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};`,
      'postcss.config.js': `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`,
      'client/index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
      'client/src/main.tsx': `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);`,
      'client/src/App.tsx': `import { Route, Switch } from 'wouter';
import HomePage from './pages/HomePage';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Switch>
        <Route path="/" component={HomePage} />
      </Switch>
    </div>
  );
}`,
      'client/src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}`,
      'client/src/pages/HomePage.tsx': `import { useQuery } from '@tanstack/react-query';

export default function HomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: () => fetch('/api/health').then(res => res.json())
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-gray-900 mb-4" data-testid="text-title">
        Welcome to Your App
      </h1>
      <p className="text-gray-600 mb-8" data-testid="text-description">
        Your full-stack application is ready to customize.
      </p>
      <div className="bg-white rounded-lg shadow p-6" data-testid="card-status">
        <h2 className="text-[15px] font-semibold mb-2">Server Status</h2>
        {isLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <p className="text-green-600" data-testid="text-status">
            {data?.status || 'Connected'}
          </p>
        )}
      </div>
    </div>
  );
}`,
      'client/src/lib/utils.ts': `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`,
      'server/index.ts': `import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', healthRouter);

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`,
      'server/routes/health.ts': `import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;`,
      'shared/types.ts': `export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}`,
      '.gitignore': `node_modules
dist
.env
.env.local
*.log
.DS_Store`,
      '.env.example': `PORT=3001
NODE_ENV=development`
    },
    dependencies: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'express': '^4.18.2',
      'cors': '^2.8.5',
      'wouter': '^3.0.0',
      '@tanstack/react-query': '^5.0.0'
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      '@vitejs/plugin-react': '^4.2.0',
      'typescript': '^5.3.0',
      'vite': '^5.0.0',
      'tailwindcss': '^3.4.0'
    }
  },
  'react': {
    directories: ['src', 'src/components', 'src/components/ui', 'src/hooks', 'src/lib', 'src/pages', 'public'],
    files: {
      'package.json': JSON.stringify({
        name: 'react-app',
        version: '1.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview'
        },
        dependencies: {
          'react': '^18.2.0',
          'react-dom': '^18.2.0',
          'wouter': '^3.0.0',
          '@tanstack/react-query': '^5.0.0',
          'lucide-react': '^0.300.0',
          'clsx': '^2.0.0',
          'tailwind-merge': '^2.0.0'
        },
        devDependencies: {
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          '@vitejs/plugin-react': '^4.2.0',
          'autoprefixer': '^10.4.16',
          'postcss': '^8.4.32',
          'tailwindcss': '^3.4.0',
          'typescript': '^5.3.0',
          'vite': '^5.0.0'
        }
      }, null, 2),
      'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5000,
    host: '0.0.0.0'
  }
});`,
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
          baseUrl: '.',
          paths: { '@/*': ['src/*'] }
        },
        include: ['src']
      }, null, 2),
      'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};`,
      'postcss.config.js': `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`,
      'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
      'src/main.tsx': `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);`,
      'src/App.tsx': `import { Route, Switch } from 'wouter';
import HomePage from './pages/HomePage';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Switch>
        <Route path="/" component={HomePage} />
      </Switch>
    </div>
  );
}`,
      'src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      'src/pages/HomePage.tsx': `export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-gray-900 mb-4" data-testid="text-title">
        Welcome to Your App
      </h1>
      <p className="text-gray-600" data-testid="text-description">
        Start building your application!
      </p>
    </div>
  );
}`,
      'src/lib/utils.ts': `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`,
      '.gitignore': 'node_modules\ndist\n.env\n.env.local\n'
    },
    dependencies: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'wouter': '^3.0.0',
      '@tanstack/react-query': '^5.0.0'
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      '@vitejs/plugin-react': '^4.2.0',
      'typescript': '^5.3.0',
      'vite': '^5.0.0',
      'tailwindcss': '^3.4.0'
    }
  },
  'express': {
    directories: ['src', 'src/routes', 'src/middleware', 'src/utils'],
    files: {
      'package.json': JSON.stringify({
        name: 'express-api',
        version: '1.0.0',
        type: 'module',
        scripts: {
          dev: 'tsx watch src/index.ts',
          start: 'node dist/index.js',
          build: 'tsc'
        },
        dependencies: {
          'express': '^4.18.2',
          'cors': '^2.8.5',
          'helmet': '^7.1.0',
          'zod': '^3.22.0'
        },
        devDependencies: {
          '@types/express': '^4.17.21',
          '@types/cors': '^2.8.17',
          '@types/node': '^20.0.0',
          'tsx': '^4.7.0',
          'typescript': '^5.3.0'
        }
      }, null, 2),
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'bundler',
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true
        },
        include: ['src/**/*']
      }, null, 2),
      'src/index.ts': `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRouter from './routes/api';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on http://0.0.0.0:\${PORT}\`);
});`,
      'src/routes/api.ts': `import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Example route with validation
router.get('/items', (req, res) => {
  res.json({ items: [], total: 0 });
});

router.post('/items', (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional()
  });
  
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors });
  }
  
  res.status(201).json({ id: Date.now(), ...result.data });
});

export default router;`,
      'src/middleware/errorHandler.ts': `import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
}`,
      '.gitignore': 'node_modules\ndist\n.env\n',
      '.env.example': 'PORT=5000\nNODE_ENV=development'
    },
    dependencies: {
      'express': '^4.18.2',
      'cors': '^2.8.5',
      'helmet': '^7.1.0',
      'zod': '^3.22.0'
    },
    devDependencies: {
      '@types/express': '^4.17.21',
      'tsx': '^4.7.0',
      'typescript': '^5.3.0'
    }
  },
  'default': {
    directories: ['src'],
    files: {
      'package.json': JSON.stringify({
        name: 'project',
        version: '1.0.0',
        type: 'module',
        scripts: {
          start: 'node src/index.js',
          dev: 'node --watch src/index.js'
        },
        dependencies: {},
        devDependencies: {}
      }, null, 2),
      'src/index.js': `console.log('Hello, World!');

// Your code here
`,
      '.gitignore': 'node_modules\n.env\n'
    },
    dependencies: {},
    devDependencies: {}
  }
};

export class SpeculativeScaffoldService {
  private projectsRoot: string;

  constructor(projectsRoot: string = path.join(process.cwd(), 'project-workspaces')) {
    this.projectsRoot = projectsRoot;
  }

  /**
   * Detect framework from prompt keywords
   */
  private detectFramework(prompt?: string, framework?: string): string {
    if (framework) return framework.toLowerCase();
    if (!prompt) return 'default';

    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('react') || promptLower.includes('frontend') || promptLower.includes('ui')) {
      return 'react';
    }
    if (promptLower.includes('express') || promptLower.includes('api') || promptLower.includes('backend') || promptLower.includes('server')) {
      return 'express';
    }
    if (promptLower.includes('next') || promptLower.includes('nextjs')) {
      return 'react'; // Use React template as base for Next.js
    }

    return 'default';
  }

  /**
   * Create speculative scaffold for a project
   * This runs in parallel with AI plan generation
   */
  async createScaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
    const startTime = Date.now();
    const filesCreated: string[] = [];

    try {
      const { projectId, language, framework, prompt } = options;
      const projectDir = path.join(this.projectsRoot, projectId);
      
      logger.info(`[Scaffold] Starting speculative scaffolding for project ${projectId}`, { 
        framework, 
        language,
        prompt: prompt?.substring(0, 50) 
      });

      // Detect framework from prompt
      const detectedFramework = this.detectFramework(prompt, framework);
      const template = FRAMEWORK_TEMPLATES[detectedFramework] || FRAMEWORK_TEMPLATES['default'];

      logger.info(`[Scaffold] Detected framework: ${detectedFramework}`);

      // Create project directory if it doesn't exist
      await fs.mkdir(projectDir, { recursive: true });

      // Create subdirectories
      for (const dir of template.directories) {
        const dirPath = path.join(projectDir, dir);
        await fs.mkdir(dirPath, { recursive: true });
        logger.debug(`[Scaffold] Created directory: ${dir}`);
      }

      // Create template files (only if they don't exist - don't overwrite)
      for (const [filePath, content] of Object.entries(template.files)) {
        const fullPath = path.join(projectDir, filePath);
        
        try {
          await fs.access(fullPath);
          // File exists, skip
          logger.debug(`[Scaffold] Skipping existing file: ${filePath}`);
        } catch (err: any) { console.error("[catch]", err?.message || err);
          // File doesn't exist, create it
          await fs.writeFile(fullPath, content, 'utf-8');
          filesCreated.push(filePath);
          logger.debug(`[Scaffold] Created file: ${filePath}`);
        }
      }

      const durationMs = Date.now() - startTime;
      logger.info(`[Scaffold] Scaffolding completed in ${durationMs}ms`, {
        filesCreated: filesCreated.length,
        projectId,
        framework: detectedFramework
      });

      return {
        success: true,
        filesCreated,
        durationMs,
        framework: detectedFramework,
        dependencies: Object.keys(template.dependencies || {}),
        devDependencies: Object.keys(template.devDependencies || {})
      };

    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      logger.error(`[Scaffold] Scaffolding failed:`, { error: error.message });
      
      return {
        success: false,
        filesCreated,
        durationMs,
        framework: 'unknown',
        dependencies: [],
        devDependencies: [],
        error: error.message
      };
    }
  }

  /**
   * Check if a project already has scaffold files
   */
  async hasExistingScaffold(projectId: string): Promise<boolean> {
    const projectDir = path.join(this.projectsRoot, projectId);
    
    try {
      const packageJson = path.join(projectDir, 'package.json');
      await fs.access(packageJson);
      return true;
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return false;
    }
  }

  /**
   * Get available framework templates
   */
  getAvailableFrameworks(): string[] {
    return Object.keys(FRAMEWORK_TEMPLATES);
  }

  /**
   * Enhanced detection: determines if app needs fullstack setup
   */
  detectAppType(prompt?: string): 'react-vite-fullstack' | 'react' | 'express' | 'default' {
    if (!prompt) return 'default';
    
    const promptLower = prompt.toLowerCase();
    
    // Fullstack indicators
    const hasBackend = promptLower.includes('backend') || promptLower.includes('api') || 
                       promptLower.includes('database') || promptLower.includes('server') ||
                       promptLower.includes('auth');
    const hasFrontend = promptLower.includes('frontend') || promptLower.includes('ui') || 
                        promptLower.includes('react') || promptLower.includes('dashboard') ||
                        promptLower.includes('website') || promptLower.includes('app');
    
    // If both frontend and backend mentioned, use fullstack
    if (hasBackend && hasFrontend) {
      return 'react-vite-fullstack';
    }
    
    // Common fullstack app types
    if (promptLower.includes('full-stack') || promptLower.includes('fullstack') ||
        promptLower.includes('crud') || promptLower.includes('todo') ||
        promptLower.includes('blog') || promptLower.includes('e-commerce') ||
        promptLower.includes('ecommerce') || promptLower.includes('store') ||
        promptLower.includes('marketplace')) {
      return 'react-vite-fullstack';
    }
    
    // Frontend only
    if (hasFrontend && !hasBackend) {
      return 'react';
    }
    
    // Backend only
    if (hasBackend && !hasFrontend) {
      return 'express';
    }
    
    // Default to fullstack for most prompts (most apps need both)
    return 'react-vite-fullstack';
  }
}

export const speculativeScaffold = new SpeculativeScaffoldService();
