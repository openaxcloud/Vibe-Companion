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
          'tailwind-merge': '^2.0.0',
          // shadcn/ui + modern UI stack
          'class-variance-authority': '^0.7.0',
          '@radix-ui/react-slot': '^1.0.2',
          'framer-motion': '^11.0.0',
          'next-themes': '^0.3.0',
          'tailwindcss-animate': '^1.0.7'
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
  darkMode: ['class'],
  content: ['./client/index.html', './client/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};`,
      'postcss.config.js': `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`,
      'client/index.html': `<!DOCTYPE html>
<html lang="en" suppressHydrationWarning>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
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
import { ThemeProvider } from 'next-themes';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
);`,
      'client/src/App.tsx': `import { Route, Switch } from 'wouter';
import HomePage from './pages/HomePage';

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Switch>
        <Route path="/" component={HomePage} />
      </Switch>
    </div>
  );
}`,
      'client/src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
  }
  * { @apply border-border; }
  body { @apply bg-background text-foreground; font-family: 'Inter', system-ui, sans-serif; }
  h1, h2, h3 { text-wrap: balance; }
}`,
      'client/src/pages/HomePage.tsx': `import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function HomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: () => fetch('/api/health').then(res => res.json())
  });

  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" aria-hidden />

      <section className="container mx-auto max-w-4xl px-6 py-24 sm:py-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            <span className="bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
              Build something great
            </span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Your full-stack app is ready. Replace this page with your idea — the stack is modern, the defaults are sane.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg" className="gap-2" data-testid="button-get-started">
              Get started <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" data-testid="button-docs">
              Documentation
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 mx-auto max-w-md rounded-lg border border-border/40 bg-card p-6 text-left shadow-sm"
          data-testid="card-status"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-foreground/80" />
            <h2 className="text-sm font-semibold">Server status</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground" data-testid="text-status">
            {isLoading ? 'Checking…' : (data?.status || 'Connected')}
          </p>
        </motion.div>
      </section>
    </main>
  );
}`,
      'client/src/components/ui/button.tsx': `import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';
`,
      'components.json': JSON.stringify({
        '$schema': 'https://ui.shadcn.com/schema.json',
        style: 'default',
        rsc: false,
        tsx: true,
        tailwind: {
          config: 'tailwind.config.js',
          css: 'client/src/index.css',
          baseColor: 'neutral',
          cssVariables: true,
          prefix: ''
        },
        aliases: {
          components: '@/components',
          utils: '@/lib/utils',
          ui: '@/components/ui'
        }
      }, null, 2),
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
