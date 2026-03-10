import { spawn } from "child_process";
import { writeFile, mkdir, rm, chmod } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { log } from "./index";
import { transformSync } from "esbuild";
import * as acorn from "acorn";
import * as walk from "acorn-walk";

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  securityViolation?: string;
  durationMs?: number;
}

const MAX_EXECUTION_TIME_MS = 10000;
const MAX_OUTPUT_SIZE = 200000;
const MAX_CODE_SIZE = 500000;
const NODE_MEMORY_LIMIT_MB = 64;

const DANGEROUS_MODULES = new Set([
  "child_process", "fs", "fs/promises", "net", "http", "https", "http2",
  "dgram", "cluster", "worker_threads", "vm", "v8", "inspector",
  "perf_hooks", "async_hooks", "tls", "dns", "os", "path",
  "readline", "repl", "stream", "zlib", "crypto",
]);

const DANGEROUS_GLOBALS = new Set([
  "process", "global", "globalThis", "root", "GLOBAL",
  "require", "module", "exports", "__dirname", "__filename",
]);

const DANGEROUS_PROPERTIES = new Set([
  "constructor", "__proto__", "prototype",
]);

const DANGEROUS_CALLEE_NAMES = new Set([
  "eval", "Function", "execSync", "spawnSync", "exec", "spawn",
  "setTimeout", "setInterval", "setImmediate",
]);

interface SecurityViolation {
  type: string;
  detail: string;
  line?: number;
  column?: number;
}

function analyzeJavaScriptAST(code: string): SecurityViolation[] {
  const violations: SecurityViolation[] = [];

  let ast: acorn.Node;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      allowAwaitOutsideFunction: true,
      locations: true,
    });
  } catch {
    try {
      ast = acorn.parse(code, {
        ecmaVersion: "latest",
        sourceType: "script",
        locations: true,
      });
    } catch {
      return violations;
    }
  }

  walk.simple(ast, {
    CallExpression(node: any) {
      if (node.callee.type === "Identifier") {
        const name = node.callee.name;

        if (name === "require" && node.arguments.length > 0) {
          const arg = node.arguments[0];
          if (arg.type === "Literal" && typeof arg.value === "string") {
            const modName = arg.value.split("/")[0];
            if (DANGEROUS_MODULES.has(modName) || DANGEROUS_MODULES.has(arg.value)) {
              violations.push({
                type: "DANGEROUS_MODULE",
                detail: `Import of dangerous module: ${arg.value}`,
                line: node.loc?.start?.line,
                column: node.loc?.start?.column,
              });
            }
          } else {
            violations.push({
              type: "DYNAMIC_REQUIRE",
              detail: "Dynamic require() with non-literal argument detected",
              line: node.loc?.start?.line,
              column: node.loc?.start?.column,
            });
          }
        }

        if (DANGEROUS_CALLEE_NAMES.has(name)) {
          if (name === "Function") {
            violations.push({
              type: "FUNCTION_CONSTRUCTOR",
              detail: "Function constructor can execute arbitrary code",
              line: node.loc?.start?.line,
              column: node.loc?.start?.column,
            });
          }
          if (name === "eval") {
            violations.push({
              type: "EVAL",
              detail: "eval() can execute arbitrary code",
              line: node.loc?.start?.line,
              column: node.loc?.start?.column,
            });
          }
        }
      }

      if (node.callee.type === "MemberExpression" && node.callee.object.type === "Identifier") {
        const objName = node.callee.object.name;
        if (objName === "process") {
          violations.push({
            type: "PROCESS_ACCESS",
            detail: `Access to process object: process.${node.callee.property?.name || node.callee.property?.value || "?"}`,
            line: node.loc?.start?.line,
            column: node.loc?.start?.column,
          });
        }
      }
    },

    ImportDeclaration(node: any) {
      const source = node.source?.value;
      if (source && typeof source === "string") {
        const modName = source.split("/")[0];
        if (DANGEROUS_MODULES.has(modName) || DANGEROUS_MODULES.has(source)) {
          violations.push({
            type: "DANGEROUS_MODULE",
            detail: `Import of dangerous module: ${source}`,
            line: node.loc?.start?.line,
            column: node.loc?.start?.column,
          });
        }
      }
    },

    ImportExpression(node: any) {
      if (node.source?.type === "Literal" && typeof node.source.value === "string") {
        const modName = node.source.value.split("/")[0];
        if (DANGEROUS_MODULES.has(modName) || DANGEROUS_MODULES.has(node.source.value)) {
          violations.push({
            type: "DANGEROUS_MODULE",
            detail: `Dynamic import of dangerous module: ${node.source.value}`,
            line: node.loc?.start?.line,
            column: node.loc?.start?.column,
          });
        }
      } else {
        violations.push({
          type: "DYNAMIC_IMPORT",
          detail: "Dynamic import() with non-literal argument detected",
          line: node.loc?.start?.line,
          column: node.loc?.start?.column,
        });
      }
    },

    MemberExpression(node: any) {
      if (node.object.type === "Identifier" && DANGEROUS_GLOBALS.has(node.object.name)) {
        const objName = node.object.name;
        if (objName === "process" || objName === "global" || objName === "globalThis" || objName === "GLOBAL" || objName === "root") {
          violations.push({
            type: "DANGEROUS_GLOBAL",
            detail: `Access to dangerous global: ${objName}`,
            line: node.loc?.start?.line,
            column: node.loc?.start?.column,
          });
        }
      }

      if (node.computed && node.property?.type === "Literal") {
        const propVal = node.property.value;
        if (typeof propVal === "string" && DANGEROUS_PROPERTIES.has(propVal)) {
          violations.push({
            type: "PROTOTYPE_ACCESS",
            detail: `Computed access to dangerous property: ["${propVal}"]`,
            line: node.loc?.start?.line,
            column: node.loc?.start?.column,
          });
        }
      }

      if (!node.computed && node.property?.type === "Identifier") {
        const propName = node.property.name;
        if (propName === "__proto__") {
          violations.push({
            type: "PROTO_ACCESS",
            detail: "Access to __proto__ property",
            line: node.loc?.start?.line,
            column: node.loc?.start?.column,
          });
        }
      }
    },

    Identifier(node: any) {
      if (node.name === "Deno" || node.name === "Bun") {
        violations.push({
          type: "ALTERNATE_RUNTIME",
          detail: `Reference to alternate runtime: ${node.name}`,
          line: node.loc?.start?.line,
          column: node.loc?.start?.column,
        });
      }
    },

    TemplateLiteral(node: any) {
      for (const expr of node.expressions || []) {
        if (expr.type === "Identifier" && DANGEROUS_GLOBALS.has(expr.name)) {
          violations.push({
            type: "TEMPLATE_INJECTION",
            detail: `Dangerous global in template literal: ${expr.name}`,
            line: node.loc?.start?.line,
            column: node.loc?.start?.column,
          });
        }
      }
    },
  });

  return violations;
}

function deepPatternScan(code: string): SecurityViolation[] {
  const violations: SecurityViolation[] = [];

  const hexEscapePattern = /\\x[0-9a-fA-F]{2}/g;
  const unicodeEscapePattern = /\\u[0-9a-fA-F]{4}/g;
  const unicodeBracePattern = /\\u\{[0-9a-fA-F]+\}/g;

  const resolveEscapes = (str: string): string => {
    return str
      .replace(hexEscapePattern, (match) => String.fromCharCode(parseInt(match.slice(2), 16)))
      .replace(unicodeEscapePattern, (match) => String.fromCharCode(parseInt(match.slice(2), 16)))
      .replace(unicodeBracePattern, (match) => String.fromCodePoint(parseInt(match.slice(3, -1), 16)));
  };

  const resolved = resolveEscapes(code);

  for (const mod of DANGEROUS_MODULES) {
    if (resolved.includes(`'${mod}'`) || resolved.includes(`"${mod}"`) || resolved.includes(`\`${mod}\``)) {
      if (!code.includes(`'${mod}'`) && !code.includes(`"${mod}"`) && !code.includes(`\`${mod}\``)) {
        violations.push({
          type: "OBFUSCATED_MODULE",
          detail: `Obfuscated reference to dangerous module: ${mod} (via escape sequences)`,
        });
      }
    }
  }

  const concatPatterns = [
    /['"]child['"\s]*\+\s*['"]_process['"]/i,
    /['"]child_['"\s]*\+\s*['"]process['"]/i,
    /String\.fromCharCode/i,
    /Buffer\.from\s*\([^)]*\)\s*\.toString/,
    /atob\s*\(/,
    /btoa\s*\(/,
  ];

  for (const pattern of concatPatterns) {
    if (pattern.test(code)) {
      violations.push({
        type: "STRING_OBFUSCATION",
        detail: `Potential string obfuscation technique detected: ${pattern.source}`,
      });
    }
  }

  const protoPatterns = [
    /\[\s*['"]constructor['"]\s*\]/,
    /\[\s*['"]__proto__['"]\s*\]/,
    /\[\s*['"]prototype['"]\s*\]/,
    /Object\s*\.\s*getPrototypeOf/,
    /Object\s*\.\s*setPrototypeOf/,
    /Reflect\s*\.\s*construct/,
    /Proxy\s*\(/,
  ];

  for (const pattern of protoPatterns) {
    if (pattern.test(code)) {
      violations.push({
        type: "PROTOTYPE_MANIPULATION",
        detail: `Prototype manipulation detected: ${pattern.source}`,
      });
    }
  }

  const dangerousPatterns = [
    { pattern: /with\s*\(/, type: "WITH_STATEMENT", detail: "with() statement can bypass scope restrictions" },
    { pattern: /debugger\b/, type: "DEBUGGER", detail: "debugger statement detected" },
    { pattern: /WebAssembly/, type: "WASM", detail: "WebAssembly usage not allowed in sandbox" },
    { pattern: /SharedArrayBuffer/, type: "SHARED_MEMORY", detail: "SharedArrayBuffer not allowed in sandbox" },
    { pattern: /Atomics\s*\./, type: "ATOMICS", detail: "Atomics not allowed in sandbox" },
  ];

  for (const { pattern, type, detail } of dangerousPatterns) {
    if (pattern.test(code)) {
      violations.push({ type, detail });
    }
  }

  return violations;
}

function analyzePythonCode(code: string): SecurityViolation[] {
  const violations: SecurityViolation[] = [];

  const dangerousImports = [
    "os", "sys", "subprocess", "shutil", "socket", "http",
    "urllib", "requests", "ctypes", "signal", "resource",
    "multiprocessing", "threading", "asyncio", "pathlib",
    "tempfile", "glob", "fnmatch", "pickle", "shelve",
    "marshal", "importlib", "runpy", "code", "codeop",
    "compile", "compileall", "py_compile",
  ];

  const importPatterns = [
    /^\s*import\s+(\w+)/gm,
    /^\s*from\s+(\w+)\s+import/gm,
  ];

  for (const pattern of importPatterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      const modName = match[1];
      if (dangerousImports.includes(modName)) {
        violations.push({
          type: "PYTHON_DANGEROUS_MODULE",
          detail: `Import of dangerous Python module: ${modName}`,
        });
      }
    }
  }

  const dangerousFunctions = [
    { pattern: /\bexec\s*\(/, detail: "exec() can execute arbitrary code" },
    { pattern: /\beval\s*\(/, detail: "eval() can execute arbitrary code" },
    { pattern: /\bcompile\s*\(/, detail: "compile() can create executable code" },
    { pattern: /\b__import__\s*\(/, detail: "__import__() dynamic import" },
    { pattern: /\bgetattr\s*\(/, detail: "getattr() can access dangerous attributes" },
    { pattern: /\bsetattr\s*\(/, detail: "setattr() can modify objects" },
    { pattern: /\bdelattr\s*\(/, detail: "delattr() can delete attributes" },
    { pattern: /\bopen\s*\(/, detail: "open() file access not allowed" },
    { pattern: /\bglobals\s*\(/, detail: "globals() can access global scope" },
    { pattern: /\blocals\s*\(/, detail: "locals() can access local scope" },
    { pattern: /\bvars\s*\(/, detail: "vars() can access object attributes" },
    { pattern: /\bdir\s*\(/, detail: "dir() can enumerate attributes" },
    { pattern: /\btype\s*\(\s*['"][^'"]+['"],/, detail: "Dynamic type creation" },
    { pattern: /\b__builtins__/, detail: "Access to __builtins__" },
    { pattern: /\b__class__/, detail: "Access to __class__" },
    { pattern: /\b__subclasses__\s*\(/, detail: "Access to __subclasses__()" },
    { pattern: /\b__bases__/, detail: "Access to __bases__" },
    { pattern: /\b__mro__/, detail: "Access to __mro__" },
    { pattern: /\bbreakpoint\s*\(/, detail: "breakpoint() not allowed" },
  ];

  for (const { pattern, detail } of dangerousFunctions) {
    if (pattern.test(code)) {
      violations.push({ type: "PYTHON_DANGEROUS_FUNCTION", detail });
    }
  }

  return violations;
}

function generateJSWrapper(userCode: string, sandboxDir: string): string {
  return `
"use strict";

(function(_module, _exports, _require, _filename, _dirname) {
  const _allowedModules = new Set(["console", "assert", "util", "events", "buffer", "string_decoder", "querystring", "url", "punycode"]);
  const _origRequire = _require;

  const _sandboxRequire = function(mod) {
    if (_allowedModules.has(mod)) {
      return _origRequire(mod);
    }
    throw new Error('Sandbox: module "' + mod + '" is not allowed. Only safe modules are permitted: ' + [..._allowedModules].join(', '));
  };

  const _blockedGlobals = ['process', 'global', 'GLOBAL', 'root'];
  for (const g of _blockedGlobals) {
    try {
      Object.defineProperty(globalThis, g, {
        get() { throw new Error('Sandbox: ' + g + ' access denied'); },
        configurable: false
      });
    } catch(e) {}
  }

  const _blockedFns = ['eval', 'Function'];
  for (const fn of _blockedFns) {
    try {
      Object.defineProperty(globalThis, fn, {
        get() { throw new Error('Sandbox: ' + fn + ' access denied'); },
        configurable: false
      });
    } catch(e) {}
  }

  try {
    Object.defineProperty(globalThis, 'require', { value: _sandboxRequire, writable: false, configurable: false });
  } catch(e) {}
  try {
    Object.defineProperty(globalThis, 'module', { value: { exports: {} }, writable: false, configurable: false });
  } catch(e) {}
  try {
    Object.defineProperty(globalThis, 'exports', { value: {}, writable: false, configurable: false });
  } catch(e) {}
  try {
    Object.defineProperty(globalThis, '__dirname', { value: '', writable: false, configurable: false });
  } catch(e) {}
  try {
    Object.defineProperty(globalThis, '__filename', { value: '', writable: false, configurable: false });
  } catch(e) {}

  // User code begins (require/module/exports/etc are now shadowed and blocked)
  ${userCode}

})(undefined, undefined, require, undefined, undefined);
`;
}

function generatePythonWrapper(userCode: string, sandboxDir: string): string {
  return `
import builtins as _builtins
import traceback as _tb

_USER_BLOCKED = frozenset({
    'subprocess', 'shutil', 'ctypes', 'multiprocessing',
    'pickle', 'shelve', 'marshal',
    'pty', 'fcntl', 'termios', 'tty', 'pipes',
    'webbrowser', 'antigravity', 'turtle', 'tkinter',
    'runpy', 'compileall', 'py_compile', 'codeop',
})

_orig_import = _builtins.__import__
_sandbox_setup_done = False

def _make_safe_import(_blocked, _orig, _traceback):
    def _safe_import(name, *args, **kwargs):
        global _sandbox_setup_done
        if _sandbox_setup_done:
            base_name = name.split('.')[0]
            if base_name in _blocked:
                raise ImportError(f"Sandbox: module '{name}' is blocked for security.")
        return _orig(name, *args, **kwargs)
    return _safe_import

_builtins.__import__ = _make_safe_import(_USER_BLOCKED, _orig_import, _tb)

_orig_open = _builtins.open
def _blocked_open(*a, **kw):
    raise RuntimeError("Sandbox: open() is blocked for security — file access is not allowed")
_builtins.open = _blocked_open

_orig_breakpoint = getattr(_builtins, 'breakpoint', None)
if _orig_breakpoint:
    def _blocked_breakpoint(*a, **kw):
        raise RuntimeError("Sandbox: breakpoint() is blocked for security")
    _builtins.breakpoint = _blocked_breakpoint

del _USER_BLOCKED, _orig_import, _make_safe_import, _orig_open, _blocked_open, _orig_breakpoint
try:
    del _blocked_breakpoint
except NameError:
    pass
del _builtins, _tb
_sandbox_setup_done = True

# === User code begins ===
${userCode}
`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "\n... [output truncated]";
}

export async function executeCode(
  code: string,
  language: string,
  onLog?: (message: string, type: "info" | "error" | "success") => void,
  userId?: number,
  projectId?: number,
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const supported = ["javascript", "typescript", "python"];
  if (!supported.includes(language)) {
    return { stdout: "", stderr: `Unsupported language: ${language}`, exitCode: 1 };
  }

  if (code.length > MAX_CODE_SIZE) {
    const msg = `Code too large: ${code.length} bytes exceeds limit of ${MAX_CODE_SIZE} bytes`;
    onLog?.(msg, "error");
    return { stdout: "", stderr: msg, exitCode: 1, securityViolation: "CODE_SIZE_EXCEEDED" };
  }

  onLog?.("Analyzing code security...", "info");

  let violations: SecurityViolation[] = [];

  if (language === "python") {
    violations = analyzePythonCode(code);
  } else {
    let codeToAnalyze = code;
    if (language === "typescript") {
      try {
        const result = transformSync(code, {
          loader: "ts",
          target: "es2022",
          format: "cjs",
        });
        codeToAnalyze = result.code;
      } catch (tsErr: any) {
        const msg = `TypeScript error: ${tsErr.message.split("\n")[0]}`;
        onLog?.(msg, "error");
        return { stdout: "", stderr: msg, exitCode: 1, durationMs: Date.now() - startTime };
      }
    }

    violations = [
      ...analyzeJavaScriptAST(codeToAnalyze),
      ...deepPatternScan(codeToAnalyze),
    ];
  }

  if (violations.length > 0) {
    const summary = violations
      .map((v) => `[${v.type}] ${v.detail}${v.line ? ` (line ${v.line})` : ""}`)
      .join("\n");
    const msg = `Security violation detected:\n${summary}\n\nFor security, file system, network, process control, and code evaluation are disabled in the sandbox.`;
    onLog?.(msg, "error");
    log(`Security violation [user=${userId}, project=${projectId}]: ${violations[0].type} - ${violations[0].detail}`, "sandbox");
    return {
      stdout: "",
      stderr: msg,
      exitCode: 1,
      securityViolation: violations[0].type,
      durationMs: Date.now() - startTime,
    };
  }

  onLog?.("Preparing secure sandbox...", "info");

  const sandboxId = randomUUID();
  const sandboxDir = join("/tmp", "sandbox", sandboxId);

  try {
    await mkdir(sandboxDir, { recursive: true });

    let filename: string;
    let command: string;
    let args: string[];
    let wrappedCode: string;

    if (language === "python") {
      filename = "main.py";
      command = "python3";
      wrappedCode = generatePythonWrapper(code, sandboxDir);
      args = ["-u", "-B", join(sandboxDir, filename)];
    } else {
      filename = "index.js";
      if (language === "typescript") {
        const result = transformSync(code, {
          loader: "ts",
          target: "es2022",
          format: "cjs",
        });
        code = result.code;
      }
      wrappedCode = generateJSWrapper(code, sandboxDir);
      command = "node";
      args = [
        `--max-old-space-size=${NODE_MEMORY_LIMIT_MB}`,
        "--no-warnings",
        "--disallow-code-generation-from-strings",
        join(sandboxDir, filename),
      ];
    }

    await writeFile(join(sandboxDir, filename), wrappedCode, "utf-8");
    await chmod(join(sandboxDir, filename), 0o444);

    onLog?.(`Executing ${language} code in sandbox...`, "info");

    return await new Promise<ExecutionResult>((resolve) => {
      let stdout = "";
      let stderr = "";
      let killed = false;

      const minimalEnv: Record<string, string> = {
        HOME: sandboxDir,
        TMPDIR: sandboxDir,
        LANG: "en_US.UTF-8",
      };

      if (command === "python3" || command === "node") {
        minimalEnv.PATH = process.env.PATH || "/usr/bin:/bin";
      }

      if (language === "python") {
        minimalEnv.PYTHONDONTWRITEBYTECODE = "1";
        minimalEnv.PYTHONHASHSEED = "0";
      } else {
        minimalEnv.NODE_PATH = "";
        minimalEnv.NODE_OPTIONS = "";
        minimalEnv.NODE_EXTRA_CA_CERTS = "";
      }

      const proc = spawn(command, args, {
        cwd: sandboxDir,
        timeout: MAX_EXECUTION_TIME_MS,
        env: minimalEnv,
        stdio: ["ignore", "pipe", "pipe"],
        uid: undefined,
        gid: undefined,
      });

      const timer = setTimeout(() => {
        killed = true;
        proc.kill("SIGKILL");
      }, MAX_EXECUTION_TIME_MS);

      proc.stdout.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        stdout = truncate(stdout, MAX_OUTPUT_SIZE);
        const lines = chunk.trimEnd().split("\n");
        for (const line of lines) {
          if (line.trim()) onLog?.(line, "success");
        }
      });

      proc.stderr.on("data", (data: Buffer) => {
        const chunk = data.toString();
        if (chunk.includes("ExperimentalWarning") || chunk.includes("--experimental")) return;
        stderr += chunk;
        stderr = truncate(stderr, MAX_OUTPUT_SIZE);
        const lines = chunk.trimEnd().split("\n");
        for (const line of lines) {
          if (line.trim()) onLog?.(line, "error");
        }
      });

      proc.on("close", (exitCode) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;

        if (killed) {
          const msg = `Execution timed out (${MAX_EXECUTION_TIME_MS / 1000}s limit)`;
          onLog?.(msg, "error");
          resolve({ stdout, stderr: stderr + "\n" + msg, exitCode: 124, durationMs });
        } else {
          const code = exitCode ?? 1;
          onLog?.(
            code === 0 ? "Process exited with code 0" : `Process exited with code ${code}`,
            code === 0 ? "success" : "error"
          );
          resolve({ stdout, stderr, exitCode: code, durationMs });
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        const msg = `Execution error: ${err.message}`;
        onLog?.(msg, "error");
        resolve({ stdout, stderr: msg, exitCode: 1, durationMs: Date.now() - startTime });
      });
    });
  } catch (err: any) {
    log(`Sandbox error: ${err.message}`, "executor");
    const msg = `Sandbox setup failed: ${err.message}`;
    onLog?.(msg, "error");
    return { stdout: "", stderr: msg, exitCode: 1, durationMs: Date.now() - startTime };
  } finally {
    try {
      await rm(sandboxDir, { recursive: true, force: true });
    } catch {}
  }
}
