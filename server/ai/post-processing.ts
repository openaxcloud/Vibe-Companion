/**
 * Post-processing pipeline for AI-generated code.
 *
 * Applies (best-effort, non-blocking):
 *   1. prettier --write     → format to project conventions
 *   2. eslint --fix         → auto-fix lint issues
 *   3. tsc --noEmit         → catch type errors; if found, retry IA "fix TS errors" up to 2x
 *
 * If a tool is not installed locally, that step is skipped with a warning —
 * the pipeline never blocks code generation on missing devDeps.
 */

import { spawn } from 'child_process';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { createLogger } from '../utils/logger';
import { aiProviderManager } from './ai-provider-manager';

const logger = createLogger('post-processing');

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface PostProcessResult {
  files: GeneratedFile[];
  prettier: { ran: boolean; changed: number; error?: string };
  eslint: { ran: boolean; changed: number; warnings: number; error?: string };
  typecheck: { ran: boolean; errors: string[]; retries: number; fixedByAI: boolean };
}

const SUPPORTED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.scss', '.html', '.md']);

function isFormattable(filePath: string): boolean {
  return SUPPORTED_EXT.has(path.extname(filePath).toLowerCase());
}

async function commandExists(cmd: string): Promise<boolean> {
  return new Promise(resolve => {
    const proc = spawn('which', [cmd], { stdio: 'ignore' });
    proc.on('exit', code => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

interface RunResult { code: number; stdout: string; stderr: string; }

function runCommand(cmd: string, args: string[], cwd: string, timeoutMs = 30000): Promise<RunResult> {
  return new Promise(resolve => {
    const proc = spawn(cmd, args, { cwd, env: process.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve({ code: 124, stdout, stderr: stderr + '\n[post-processing] timeout' });
    }, timeoutMs);
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', err => {
      clearTimeout(timer);
      resolve({ code: 127, stdout, stderr: err.message });
    });
    proc.on('exit', code => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function writeFilesToWorkspace(workspace: string, files: GeneratedFile[]): Promise<void> {
  for (const file of files) {
    const fullPath = path.join(workspace, file.path);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.content, 'utf8');
  }
}

async function readFilesFromWorkspace(workspace: string, files: GeneratedFile[]): Promise<GeneratedFile[]> {
  const updated: GeneratedFile[] = [];
  for (const file of files) {
    try {
      const content = await readFile(path.join(workspace, file.path), 'utf8');
      updated.push({ path: file.path, content });
    } catch {
      updated.push(file);
    }
  }
  return updated;
}

async function runPrettier(workspace: string, files: GeneratedFile[]): Promise<PostProcessResult['prettier']> {
  const targets = files.filter(f => isFormattable(f.path)).map(f => f.path);
  if (targets.length === 0) return { ran: false, changed: 0 };

  const hasNpx = await commandExists('npx');
  if (!hasNpx) return { ran: false, changed: 0, error: 'npx not found' };

  const result = await runCommand('npx', ['--no-install', 'prettier', '--write', ...targets], workspace, 30000);
  if (result.code === 127 || /could not determine executable to run/i.test(result.stderr)) {
    return { ran: false, changed: 0, error: 'prettier not installed' };
  }
  if (result.code !== 0) {
    logger.warn(`prettier exited ${result.code}: ${result.stderr.slice(0, 500)}`);
    return { ran: true, changed: 0, error: result.stderr.slice(0, 500) };
  }
  return { ran: true, changed: targets.length };
}

async function runEslint(workspace: string, files: GeneratedFile[]): Promise<PostProcessResult['eslint']> {
  const targets = files
    .filter(f => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f.path))
    .map(f => f.path);
  if (targets.length === 0) return { ran: false, changed: 0, warnings: 0 };

  const hasNpx = await commandExists('npx');
  if (!hasNpx) return { ran: false, changed: 0, warnings: 0, error: 'npx not found' };

  const result = await runCommand(
    'npx',
    ['--no-install', 'eslint', '--fix', '--no-error-on-unmatched-pattern', ...targets],
    workspace,
    45000,
  );
  if (result.code === 127 || /could not determine executable to run/i.test(result.stderr)) {
    return { ran: false, changed: 0, warnings: 0, error: 'eslint not installed' };
  }
  // eslint exits non-zero if there are errors after --fix — non-blocking, just record
  const warningCount = (result.stdout.match(/warning/gi) || []).length;
  return { ran: true, changed: targets.length, warnings: warningCount };
}

async function runTypecheck(workspace: string): Promise<{ errors: string[]; ran: boolean }> {
  const tsTargets = ['ts', 'tsx'];
  const hasTsFiles = await Promise.any(
    tsTargets.map(async ext => {
      const result = await runCommand('find', ['.', '-name', `*.${ext}`, '-type', 'f', '-print', '-quit'], workspace, 5000);
      return result.stdout.trim().length > 0 ? true : Promise.reject();
    }),
  ).catch(() => false);
  if (!hasTsFiles) return { ran: false, errors: [] };

  const hasNpx = await commandExists('npx');
  if (!hasNpx) return { ran: false, errors: [] };

  const tsconfigPath = path.join(workspace, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    // Generate a minimal tsconfig so tsc can run on the generated files
    await writeFile(
      tsconfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            jsx: 'preserve',
            strict: false,
            skipLibCheck: true,
            allowJs: true,
            noEmit: true,
            esModuleInterop: true,
            resolveJsonModule: true,
            allowImportingTsExtensions: true,
          },
          include: ['**/*.ts', '**/*.tsx'],
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  const result = await runCommand('npx', ['--no-install', 'tsc', '--noEmit'], workspace, 60000);
  if (result.code === 127 || /could not determine executable to run/i.test(result.stderr)) {
    return { ran: false, errors: [] };
  }
  if (result.code === 0) return { ran: true, errors: [] };

  const errors = result.stdout
    .split('\n')
    .filter(line => /error TS\d+:/.test(line))
    .slice(0, 20);
  return { ran: true, errors };
}

async function retryFixWithAI(files: GeneratedFile[], errors: string[]): Promise<GeneratedFile[] | null> {
  try {
    const fileBlock = files
      .filter(f => /\.(ts|tsx)$/.test(f.path))
      .map(f => `--- ${f.path} ---\n${f.content}`)
      .join('\n\n');

    const prompt = `You generated the following files and they have TypeScript errors. Fix the type errors WITHOUT changing the public API or behavior. Return the full corrected content of each file in the same format.

TypeScript errors:
${errors.join('\n')}

Files:
${fileBlock}

Return ONLY corrected files in the format:
--- <relative/path> ---
<full corrected content>

Do not include explanations.`;

    const messages = [
      { role: 'system' as const, content: 'You are a TypeScript expert. Fix type errors precisely without altering behavior.' },
      { role: 'user' as const, content: prompt },
    ];

    let response = '';
    for await (const chunk of aiProviderManager.streamChat('claude-sonnet-4-6', messages, {
      max_tokens: 8192,
      temperature: 0.2,
      timeoutMs: 60000,
    })) {
      response += chunk;
    }

    const updated = parseFileBlocks(response);
    if (updated.length === 0) return null;

    const byPath = new Map(updated.map(f => [f.path, f]));
    return files.map(f => byPath.get(f.path) ?? f);
  } catch (err: any) {
    logger.warn(`AI retry-fix failed: ${err.message}`);
    return null;
  }
}

function parseFileBlocks(text: string): GeneratedFile[] {
  const out: GeneratedFile[] = [];
  const re = /^---\s+(.+?)\s+---\s*\n([\s\S]*?)(?=^---\s+\S+|\Z)/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const filePath = match[1].trim();
    const content = match[2].replace(/\n$/, '');
    if (filePath && content) out.push({ path: filePath, content });
  }
  return out;
}

/**
 * Post-process generated files: prettier → eslint --fix → tsc --noEmit (with up to 2 AI retries).
 * Returns the (possibly updated) files plus a report. Never throws — all errors are captured.
 */
export async function postProcessGeneratedFiles(input: GeneratedFile[]): Promise<PostProcessResult> {
  if (input.length === 0) {
    return {
      files: input,
      prettier: { ran: false, changed: 0 },
      eslint: { ran: false, changed: 0, warnings: 0 },
      typecheck: { ran: false, errors: [], retries: 0, fixedByAI: false },
    };
  }

  const workspace = await mkdtemp(path.join(tmpdir(), 'ecode-postproc-'));
  try {
    let files = [...input];
    await writeFilesToWorkspace(workspace, files);

    const prettier = await runPrettier(workspace, files);
    files = await readFilesFromWorkspace(workspace, files);

    const eslint = await runEslint(workspace, files);
    files = await readFilesFromWorkspace(workspace, files);

    let { errors, ran: typecheckRan } = await runTypecheck(workspace);
    let retries = 0;
    let fixedByAI = false;

    while (errors.length > 0 && retries < 2) {
      retries++;
      logger.info(`Typecheck found ${errors.length} errors — AI retry ${retries}/2`);
      const fixed = await retryFixWithAI(files, errors);
      if (!fixed) break;
      files = fixed;
      await writeFilesToWorkspace(workspace, files);
      const result = await runTypecheck(workspace);
      errors = result.errors;
      typecheckRan = typecheckRan || result.ran;
      if (errors.length === 0) {
        fixedByAI = true;
        break;
      }
    }

    return {
      files,
      prettier,
      eslint,
      typecheck: { ran: typecheckRan, errors, retries, fixedByAI },
    };
  } finally {
    await rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
}
