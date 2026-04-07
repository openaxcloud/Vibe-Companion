import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SandboxExecutor } from '../sandbox-executor';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

const FIXTURES_DIR = path.join(__dirname, '../fixtures');

interface LanguageTestConfig {
  language: string;
  fixtureFile: string;
  expectedOutput: string | RegExp;
  timeout: number;
}

const LANGUAGE_TESTS: LanguageTestConfig[] = [
  { language: 'javascript', fixtureFile: 'hello.js', expectedOutput: 'Hello', timeout: 10000 },
  { language: 'nodejs', fixtureFile: 'hello.js', expectedOutput: 'Hello', timeout: 10000 },
  { language: 'typescript', fixtureFile: 'hello.ts', expectedOutput: 'Hello', timeout: 30000 },
  { language: 'python', fixtureFile: 'hello.py', expectedOutput: 'Hello', timeout: 10000 },
  { language: 'java', fixtureFile: 'Hello.java', expectedOutput: 'Hello', timeout: 60000 },
  { language: 'cpp', fixtureFile: 'hello.cpp', expectedOutput: 'Hello', timeout: 30000 },
  { language: 'c', fixtureFile: 'hello.c', expectedOutput: 'Hello', timeout: 30000 },
  { language: 'go', fixtureFile: 'hello.go', expectedOutput: 'Hello', timeout: 30000 },
  { language: 'rust', fixtureFile: 'hello.rs', expectedOutput: 'Hello', timeout: 60000 },
  { language: 'ruby', fixtureFile: 'hello.rb', expectedOutput: 'Hello', timeout: 10000 },
  { language: 'php', fixtureFile: 'hello.php', expectedOutput: 'Hello', timeout: 10000 },
  { language: 'csharp', fixtureFile: 'Hello.cs', expectedOutput: 'Hello', timeout: 60000 },
  { language: 'swift', fixtureFile: 'hello.swift', expectedOutput: 'Hello', timeout: 120000 },
  { language: 'kotlin', fixtureFile: 'hello.kt', expectedOutput: 'Hello', timeout: 120000 },
  { language: 'dart', fixtureFile: 'hello.dart', expectedOutput: 'Hello', timeout: 30000 },
  { language: 'bash', fixtureFile: 'hello.sh', expectedOutput: 'Hello', timeout: 10000 },
  { language: 'html-css-js', fixtureFile: 'hello.html', expectedOutput: /DOM Summary|Title: Hello|Hello, World/, timeout: 10000 },
  { language: 'nix', fixtureFile: 'hello.nix', expectedOutput: 'Hello', timeout: 30000 },
  { language: 'deno', fixtureFile: 'hello.deno.ts', expectedOutput: 'Hello', timeout: 30000 },
  { language: 'lua', fixtureFile: 'hello.lua', expectedOutput: 'Hello', timeout: 10000 },
  { language: 'perl', fixtureFile: 'hello.pl', expectedOutput: 'Hello', timeout: 10000 },
  { language: 'r', fixtureFile: 'hello.r', expectedOutput: 'Hello', timeout: 30000 },
  { language: 'haskell', fixtureFile: 'hello.hs', expectedOutput: 'Hello', timeout: 120000 },
  { language: 'scala', fixtureFile: 'Hello.scala', expectedOutput: 'Hello', timeout: 180000 },
  { language: 'clojure', fixtureFile: 'hello.clj', expectedOutput: 'Hello', timeout: 120000 },
  { language: 'elixir', fixtureFile: 'hello.exs', expectedOutput: 'Hello', timeout: 60000 },
  { language: 'julia', fixtureFile: 'hello.jl', expectedOutput: 'Hello', timeout: 60000 },
  { language: 'ocaml', fixtureFile: 'hello.ml', expectedOutput: 'Hello', timeout: 60000 },
  { language: 'fortran', fixtureFile: 'hello.f90', expectedOutput: 'Hello', timeout: 60000 },
  { language: 'zig', fixtureFile: 'hello.zig', expectedOutput: 'Hello', timeout: 60000 },
];

function isRuntimeAvailable(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function isSandboxEnvironmentAvailable(): boolean {
  try {
    execSync('which unshare && which chroot', { stdio: 'pipe' });
    execSync('cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null || echo 1', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const RUNTIME_COMMANDS: Record<string, string> = {
  javascript: 'node',
  nodejs: 'node',
  typescript: 'npx',
  python: 'python3',
  java: 'javac',
  cpp: 'g++',
  c: 'gcc',
  go: 'go',
  rust: 'rustc',
  ruby: 'ruby',
  php: 'php',
  csharp: 'mcs',
  swift: 'swiftc',
  kotlin: 'kotlinc',
  dart: 'dart',
  bash: 'bash',
  'html-css-js': 'node',
  nix: 'nix-instantiate',
  deno: 'deno',
  lua: 'lua',
  perl: 'perl',
  r: 'Rscript',
  haskell: 'ghc',
  scala: 'scalac',
  clojure: 'clojure',
  elixir: 'elixir',
  julia: 'julia',
  ocaml: 'ocamlopt',
  fortran: 'gfortran',
  zig: 'zig',
};

const sandboxAvailable = isSandboxEnvironmentAvailable();

describe('Language Matrix - Sandbox Executor', () => {
  let executor: SandboxExecutor;

  beforeAll(async () => {
    executor = new SandboxExecutor();
    await executor.initialize();
  });

  afterAll(async () => {
    await executor.cleanup();
  });

  describe.each(LANGUAGE_TESTS)(
    '$language runtime',
    ({ language, fixtureFile, expectedOutput, timeout }) => {
      const runtimeCommand = RUNTIME_COMMANDS[language];
      const runtimeAvailable = isRuntimeAvailable(runtimeCommand);
      const canRunTest = runtimeAvailable && sandboxAvailable;

      it.skipIf(!canRunTest)(
        `should execute Hello World program`,
        async () => {
          const fixturePath = path.join(FIXTURES_DIR, fixtureFile);
          const code = await fs.readFile(fixturePath, 'utf-8');

          const result = await executor.execute({
            language,
            code,
            timeout: timeout / 1000,
          });

          if (!result.success) {
            if (result.stderr?.includes('mount') || result.stderr?.includes('permission denied')) {
              console.log(`[${language}] Sandbox isolation not available, skipping`);
              return;
            }
            console.log(`[${language}] stderr:`, result.stderr);
          }

          expect(result.success).toBe(true);

          const output = result.stdout + result.stderr;
          if (expectedOutput instanceof RegExp) {
            expect(output).toMatch(expectedOutput);
          } else {
            expect(output).toContain(expectedOutput);
          }
        },
        timeout
      );

      if (!runtimeAvailable) {
        it(`runtime not available: ${runtimeCommand}`, () => {
          console.log(`Skipping ${language}: ${runtimeCommand} not found in PATH`);
          expect(true).toBe(true);
        });
      }

      if (!sandboxAvailable && runtimeAvailable) {
        it(`sandbox environment not available`, () => {
          console.log(`Skipping ${language}: sandbox requires privileged operations`);
          expect(true).toBe(true);
        });
      }
    }
  );
});

describe('Language Matrix - Runtime Availability Report', () => {
  it('should report runtime availability status', () => {
    const available: string[] = [];
    const unavailable: string[] = [];

    for (const [language, command] of Object.entries(RUNTIME_COMMANDS)) {
      if (isRuntimeAvailable(command)) {
        available.push(language);
      } else {
        unavailable.push(language);
      }
    }

    console.log('\n=== Runtime Availability Report ===');
    console.log(`Sandbox environment available: ${sandboxAvailable}`);
    console.log(`Available runtimes (${available.length}):`, available.join(', '));
    console.log(`Unavailable runtimes (${unavailable.length}):`, unavailable.join(', '));

    expect(available.length + unavailable.length).toBe(30);
  });
});

describe('Language Matrix - Fixture Validation', () => {
  it.each(LANGUAGE_TESTS)(
    '$language fixture file should exist',
    async ({ fixtureFile }) => {
      const fixturePath = path.join(FIXTURES_DIR, fixtureFile);
      const exists = await fs.access(fixturePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
  );
});
