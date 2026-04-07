import { spawn, type ChildProcess } from "child_process";

const activeProcesses = new Map<string, ChildProcess>();

export async function executeCode(projectId: string, command: string, cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn("sh", ["-c", command], {
      cwd: cwd || process.cwd(),
      timeout: 30000,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
    proc.on("error", (err) => resolve({ stdout, stderr: err.message, exitCode: 1 }));
    activeProcesses.set(projectId, proc);
  });
}

export function sendStdinToProcess(projectId: string, data: string): boolean {
  const proc = activeProcesses.get(projectId);
  if (proc?.stdin?.writable) {
    proc.stdin.write(data);
    return true;
  }
  return false;
}

export function killInteractiveProcess(projectId: string): boolean {
  const proc = activeProcesses.get(projectId);
  if (proc) {
    proc.kill("SIGTERM");
    activeProcesses.delete(projectId);
    return true;
  }
  return false;
}

export function resolveRunCommand(language: string, filename: string): string {
  const commands: Record<string, string> = {
    javascript: `node ${filename}`,
    typescript: `tsx ${filename}`,
    python: `python3 ${filename}`,
    python3: `python3 ${filename}`,
    ruby: `ruby ${filename}`,
    go: `go run ${filename}`,
    rust: `cargo run`,
    java: `javac ${filename} && java ${filename.replace(".java", "")}`,
    cpp: `g++ -o /tmp/a.out ${filename} && /tmp/a.out`,
    c: `gcc -o /tmp/a.out ${filename} && /tmp/a.out`,
    bash: `bash ${filename}`,
    shell: `sh ${filename}`,
    php: `php ${filename}`,
  };
  return commands[language.toLowerCase()] || `node ${filename}`;
}
