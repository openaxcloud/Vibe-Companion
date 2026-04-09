import fs from 'fs/promises';
import path from 'path';

export interface EcodeContext {
  projectName: string;
  projectDescription?: string;
  files?: Array<{ name: string; path?: string; content?: string }>;
  packageJson?: any;
  framework?: string;
  projectType?: string;
  userPreferences?: Record<string, any>;
}

export function generateEcodeContent(projectName: string, context?: EcodeContext): string {
  const ctx = context || { projectName };
  const pkg = ctx.packageJson || {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  const projectType = ctx.projectType || detectProjectType(deps);
  const framework = ctx.framework || detectFramework(deps);
  const buildTool = detectBuildTool(deps);
  const styling = detectStyling(deps);
  const stateManagement = detectStateManagement(deps);
  const routing = detectRouting(deps);
  const orm = detectORM(deps);
  const dbProvider = detectDBProvider(deps);
  const testing = detectTestFramework(deps);

  let md = `# ${projectName}\n\n`;

  md += `## Overview\n\n`;
  if (ctx.projectDescription) {
    md += `${ctx.projectDescription}\n\n`;
  } else {
    md += `This is a ${projectType} built with modern web technologies. It provides a full-stack development experience with ${framework} on the frontend and ${deps['express'] ? 'Express.js' : deps['fastify'] ? 'Fastify' : 'Node.js'} on the backend.\n\n`;
  }

  if (ctx.userPreferences && Object.keys(ctx.userPreferences).length > 0) {
    md += `## User Preferences\n\n`;
    for (const [key, value] of Object.entries(ctx.userPreferences)) {
      md += `- **${key}**: ${value}\n`;
    }
    md += `\n`;
  }

  md += `## System Architecture\n\n`;

  md += `### Frontend Architecture\n\n`;
  if (deps['react'] || deps['vue'] || deps['svelte'] || deps['@angular/core']) {
    md += `- **Framework**: ${framework}\n`;
    md += `- **Build Tool**: ${buildTool}\n`;
    if (styling) md += `- **Styling**: ${styling}\n`;
    if (stateManagement) md += `- **State Management**: ${stateManagement}\n`;
    if (routing) md += `- **Routing**: ${routing}\n`;
    md += `- **Theme System**: Custom theme provider with light/dark mode support\n`;
  } else {
    md += `- **Type**: Static / vanilla frontend\n`;
    md += `- **Build Tool**: ${buildTool}\n`;
  }

  md += `\n### Backend Architecture\n\n`;
  md += `- **Runtime**: ${deps['express'] ? 'Node.js with Express.js server' : deps['fastify'] ? 'Node.js with Fastify' : deps['hono'] ? 'Node.js with Hono' : 'Node.js'}\n`;
  md += `- **Language**: ${deps['typescript'] ? 'TypeScript with ES modules' : 'JavaScript'}\n`;
  if (orm) md += `- **Database ORM**: ${orm}\n`;
  if (dbProvider) md += `- **Database Provider**: ${dbProvider}\n`;

  const externalAPIs: string[] = [];
  if (deps['openai'] || deps['@openai/api']) externalAPIs.push('OpenAI API for AI features');
  if (deps['stripe']) externalAPIs.push('Stripe for payments');
  if (deps['@sendgrid/mail']) externalAPIs.push('SendGrid for email');
  if (deps['@aws-sdk/client-s3']) externalAPIs.push('AWS S3 for storage');
  if (deps['@notionhq/client']) externalAPIs.push('Notion API for content');
  if (deps['passport']) externalAPIs.push('Passport.js for authentication');
  if (externalAPIs.length > 0) {
    md += `- **External APIs**: ${externalAPIs.join(', ')}\n`;
  }
  if (deps['connect-pg-simple'] || deps['express-session']) {
    md += `- **Session Management**: ${deps['connect-pg-simple'] ? 'connect-pg-simple for PostgreSQL session storage' : 'express-session'}\n`;
  }

  if (orm || dbProvider) {
    md += `\n### Database Schema\n\n`;
    md += `- Schema validation using ${deps['drizzle-zod'] ? 'Drizzle-Zod' : deps['zod'] ? 'Zod' : 'runtime validation'} for type-safe operations\n`;
    md += `- See \`shared/schema.ts\` for complete table definitions\n`;
  }

  md += `\n## Key Conventions\n\n`;
  md += `1. Use ${deps['typescript'] ? 'TypeScript strict mode' : 'JavaScript ES modules'} for all new files\n`;
  if (deps['react']) {
    md += `2. Prefer functional components with hooks over class components\n`;
  }
  if (styling === 'Tailwind CSS with shadcn/ui component library') {
    md += `3. Use Tailwind CSS utility classes for styling; use shadcn/ui components where available\n`;
  } else if (styling) {
    md += `3. Use ${styling} for styling\n`;
  }
  md += `4. Always include TypeScript types for function parameters and return values\n`;
  md += `5. Handle errors gracefully with try-catch and user-friendly messages\n`;
  md += `6. Use environment variables for all secrets and configuration\n`;

  if (pkg.scripts) {
    md += `\n## Scripts\n\n`;
    for (const [name, cmd] of Object.entries(pkg.scripts)) {
      md += `- \`npm run ${name}\`: ${cmd}\n`;
    }
  }

  if (testing) {
    md += `\n## Testing\n\n`;
    md += `- Framework: ${testing}\n`;
    md += `- Run tests with: \`npm test\`\n`;
  }

  md += `\n## Development Workflow\n\n`;
  md += `- This file (\`ecode.md\`) is automatically read by the E-Code AI Agent on every conversation\n`;
  md += `- Edit this file to customize the Agent's behavior, coding style, and project understanding\n`;
  md += `- The Agent will update this file when it makes significant architectural changes\n`;
  md += `- Delete this file and start a new conversation to regenerate it from scratch\n`;

  return md;
}

export function getEcodeFilename(_projectName?: string): string {
  return 'ecode.md';
}

export function buildProjectStructureTree(files: Array<{ name: string; path?: string }>): string {
  return files.map((f) => `├── ${f.path || f.name}`).join("\n");
}

export function detectDependencies(files: Array<{ name: string; content?: string }>): string[] {
  const deps: string[] = [];
  for (const f of files) {
    if (f.name === "package.json" && f.content) {
      try {
        const pkg = JSON.parse(f.content);
        deps.push(...Object.keys(pkg.dependencies || {}));
      } catch (err: any) { console.error("[catch]", err?.message || err);}
    }
  }
  return deps;
}

export function detectDependenciesFromPackageJson(packageJson: any): string[] {
  return Object.keys(packageJson?.dependencies || {});
}

export function parseUserPreferences(prefs: any): Record<string, any> {
  return prefs || {};
}

export function parseProjectContext(context: any): Record<string, any> {
  return context || {};
}

export function updateEcodeStructureSection(content: string, structure: string): string {
  return content.replace(/## Structure[\s\S]*?(?=##|$)/, `## Structure\n\n${structure}\n\n`);
}

export function buildEcodePromptContext(projectName: string, files: any[], prefs: any): string {
  return `Project: ${projectName}\nFiles: ${files.length}\n`;
}

export function shouldAutoUpdate(lastUpdated?: Date): boolean {
  if (!lastUpdated) return true;
  const hoursSince = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
  return hoursSince > 1;
}

export async function readEcodeMd(projectRoot: string): Promise<string | null> {
  try {
    const filePath = path.join(projectRoot, 'ecode.md');
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch {
    return null;
  }
}

export async function writeEcodeMd(projectRoot: string, content: string): Promise<void> {
  const filePath = path.join(projectRoot, 'ecode.md');
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function autoGenerateEcodeMd(projectRoot: string): Promise<string> {
  let packageJson: any = null;
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const raw = await fs.readFile(pkgPath, 'utf-8');
    packageJson = JSON.parse(raw);
  } catch {}

  const projectName = packageJson?.name || path.basename(projectRoot);
  const description = packageJson?.description || '';

  const content = generateEcodeContent(projectName, {
    projectName,
    projectDescription: description || undefined,
    packageJson,
  });

  await writeEcodeMd(projectRoot, content);
  return content;
}

function detectProjectType(deps: Record<string, string>): string {
  if (deps['next']) return 'Next.js Application';
  if (deps['react']) return 'React Application';
  if (deps['vue']) return 'Vue.js Application';
  if (deps['svelte']) return 'Svelte Application';
  if (deps['@angular/core']) return 'Angular Application';
  if (deps['express'] || deps['fastify'] || deps['hono']) return 'Node.js API Server';
  if (deps['typescript']) return 'TypeScript Project';
  return 'Node.js Project';
}

function detectFramework(deps: Record<string, string>): string {
  if (deps['next']) return 'Next.js ' + (deps['next'] || '');
  if (deps['react']) return 'React ' + (deps['react'] || '18') + ' with TypeScript';
  if (deps['vue']) return 'Vue.js ' + (deps['vue'] || '3');
  if (deps['svelte']) return 'Svelte ' + (deps['svelte'] || '');
  if (deps['@angular/core']) return 'Angular ' + (deps['@angular/core'] || '');
  return 'Vanilla JavaScript';
}

function detectBuildTool(deps: Record<string, string>): string {
  if (deps['vite']) return 'Vite for fast development and optimized builds';
  if (deps['webpack']) return 'Webpack';
  if (deps['parcel']) return 'Parcel';
  if (deps['esbuild']) return 'esbuild';
  if (deps['next']) return 'Next.js built-in bundler';
  return 'None detected';
}

function detectStyling(deps: Record<string, string>): string | null {
  const parts: string[] = [];
  if (deps['tailwindcss']) parts.push('Tailwind CSS');
  if (deps['@radix-ui/react-dialog'] || deps['class-variance-authority']) parts.push('shadcn/ui component library');
  if (parts.length > 0) return parts.join(' with ');
  if (deps['styled-components']) return 'styled-components';
  if (deps['@emotion/react']) return 'Emotion';
  if (deps['sass']) return 'Sass/SCSS';
  return null;
}

function detectStateManagement(deps: Record<string, string>): string | null {
  if (deps['@tanstack/react-query']) return 'TanStack Query for server state management';
  if (deps['zustand']) return 'Zustand';
  if (deps['redux'] || deps['@reduxjs/toolkit']) return 'Redux Toolkit';
  if (deps['mobx']) return 'MobX';
  if (deps['jotai']) return 'Jotai';
  if (deps['recoil']) return 'Recoil';
  return null;
}

function detectRouting(deps: Record<string, string>): string | null {
  if (deps['wouter']) return 'Wouter for lightweight client-side routing';
  if (deps['react-router-dom']) return 'React Router';
  if (deps['@tanstack/react-router']) return 'TanStack Router';
  return null;
}

function detectORM(deps: Record<string, string>): string | null {
  if (deps['drizzle-orm']) return 'Drizzle ORM with PostgreSQL';
  if (deps['prisma'] || deps['@prisma/client']) return 'Prisma';
  if (deps['typeorm']) return 'TypeORM';
  if (deps['sequelize']) return 'Sequelize';
  if (deps['mongoose']) return 'Mongoose (MongoDB)';
  if (deps['knex']) return 'Knex.js';
  return null;
}

function detectDBProvider(deps: Record<string, string>): string | null {
  if (deps['@neondatabase/serverless']) return 'Neon serverless PostgreSQL';
  if (deps['pg']) return 'PostgreSQL';
  if (deps['mysql2']) return 'MySQL';
  if (deps['better-sqlite3']) return 'SQLite';
  if (deps['mongodb']) return 'MongoDB';
  return null;
}

function detectTestFramework(deps: Record<string, string>): string | null {
  if (deps['vitest']) return 'Vitest';
  if (deps['jest']) return 'Jest';
  if (deps['@playwright/test']) return 'Playwright';
  if (deps['cypress']) return 'Cypress';
  if (deps['mocha']) return 'Mocha';
  return null;
}
