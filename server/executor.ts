import { spawn } from "child_process";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { log } from "./index";
import { transformSync } from "esbuild";

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const MAX_EXECUTION_TIME_MS = 10000;
const MAX_OUTPUT_SIZE = 200000;

const FORBIDDEN_PATTERNS = [
  /require\s*\(\s*['"]child_process/i,
  /require\s*\(\s*['"]fs/i,
  /require\s*\(\s*['"]net/i,
  /require\s*\(\s*['"]http/i,
  /require\s*\(\s*['"]https/i,
  /require\s*\(\s*['"]dgram/i,
  /require\s*\(\s*['"]cluster/i,
  /require\s*\(\s*['"]worker_threads/i,
  /import\s+.*from\s+['"]child_process/i,
  /import\s+.*from\s+['"]fs/i,
  /import\s+.*from\s+['"]net/i,
  /process\.exit/i,
  /process\.env/i,
  /process\.kill/i,
  /eval\s*\(/,
  /Function\s*\(/,
  /exec\s*\(/,
  /execSync/,
  /spawnSync/,
  /import\s*\(/,
  /globalThis/,
  /Deno\./,
  /Bun\./,
];

function sanitizeCode(code: string, language: string): string | null {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      return `Blocked: Code contains forbidden pattern (${pattern.source}). For security, file system access, network access, and process control are disabled.`;
    }
  }
  return null;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "\n... [output truncated]";
}

export async function executeCode(
  code: string,
  language: string,
  onLog?: (message: string, type: "info" | "error" | "success") => void
): Promise<ExecutionResult> {
  const supported = ["javascript", "typescript", "python"];
  if (!supported.includes(language)) {
    return { stdout: "", stderr: `Unsupported language: ${language}`, exitCode: 1 };
  }

  const violation = sanitizeCode(code, language);
  if (violation) {
    onLog?.(violation, "error");
    return { stdout: "", stderr: violation, exitCode: 1 };
  }

  onLog?.("Preparing sandbox environment...", "info");

  const sandboxId = randomUUID();
  const sandboxDir = join("/tmp", "sandbox", sandboxId);

  try {
    await mkdir(sandboxDir, { recursive: true });

    let filename: string;
    let command: string;
    let args: string[];

    if (language === "python") {
      filename = "main.py";
      command = "python3";
      args = [join(sandboxDir, filename)];
    } else {
      filename = "index.js";
      if (language === "typescript") {
        try {
          const result = transformSync(code, {
            loader: "ts",
            target: "es2022",
            format: "cjs",
          });
          code = result.code;
        } catch (tsErr: any) {
          const msg = `TypeScript error: ${tsErr.message.split("\n")[0]}`;
          onLog?.(msg, "error");
          return { stdout: "", stderr: msg, exitCode: 1 };
        }
      }
      command = "node";
      args = ["--max-old-space-size=64", join(sandboxDir, filename)];
    }

    await writeFile(join(sandboxDir, filename), code, "utf-8");

    onLog?.(`Executing ${language} code...`, "info");

    return await new Promise<ExecutionResult>((resolve) => {
      let stdout = "";
      let stderr = "";
      let killed = false;

      const proc = spawn(command, args, {
        cwd: sandboxDir,
        timeout: MAX_EXECUTION_TIME_MS,
        env: {
          PATH: process.env.PATH,
          HOME: sandboxDir,
          NODE_PATH: "",
          PYTHONPATH: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      const timer = setTimeout(() => {
        killed = true;
        proc.kill("SIGKILL");
      }, MAX_EXECUTION_TIME_MS);

      proc.stdout.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        stdout = truncate(stdout, MAX_OUTPUT_SIZE);
        onLog?.(chunk.trimEnd(), "success");
      });

      proc.stderr.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        stderr = truncate(stderr, MAX_OUTPUT_SIZE);
        onLog?.(chunk.trimEnd(), "error");
      });

      proc.on("close", (exitCode) => {
        clearTimeout(timer);

        if (killed) {
          const msg = `Execution timed out (${MAX_EXECUTION_TIME_MS / 1000}s limit)`;
          onLog?.(msg, "error");
          resolve({ stdout, stderr: stderr + "\n" + msg, exitCode: 124 });
        } else {
          const code = exitCode ?? 1;
          onLog?.(
            code === 0 ? "Process exited with code 0" : `Process exited with code ${code}`,
            code === 0 ? "success" : "error"
          );
          resolve({ stdout, stderr, exitCode: code });
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        const msg = `Execution error: ${err.message}`;
        onLog?.(msg, "error");
        resolve({ stdout, stderr: msg, exitCode: 1 });
      });
    });
  } catch (err: any) {
    log(`Sandbox error: ${err.message}`, "executor");
    const msg = `Sandbox setup failed: ${err.message}`;
    onLog?.(msg, "error");
    return { stdout: "", stderr: msg, exitCode: 1 };
  } finally {
    try {
      await rm(sandboxDir, { recursive: true, force: true });
    } catch {}
  }
}
