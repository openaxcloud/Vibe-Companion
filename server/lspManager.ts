import { spawn, type ChildProcess } from "child_process";
import { log } from "./index";
import { ensureLspInstalled } from "./lspSetup";

export type LSPLanguage = "typescript" | "javascript" | "python" | "go";

interface LSPServerInstance {
  process: ChildProcess;
  language: LSPLanguage;
  projectId: string;
  rootUri: string;
  startedAt: number;
  restartCount: number;
  maxRestarts: number;
  onMessage: ((data: string) => void) | null;
  pendingBuffer: Buffer;
  initialized: boolean;
  shutdownRequested: boolean;
}

const lspServers = new Map<string, LSPServerInstance>();

const LSP_COMMANDS: Record<LSPLanguage, { command: string; args: string[]; check: string }> = {
  typescript: {
    command: "npx",
    args: ["typescript-language-server", "--stdio"],
    check: "typescript-language-server",
  },
  javascript: {
    command: "npx",
    args: ["typescript-language-server", "--stdio"],
    check: "typescript-language-server",
  },
  python: {
    command: "pylsp",
    args: [],
    check: "pylsp",
  },
  go: {
    command: "gopls",
    args: ["serve"],
    check: "gopls",
  },
};

function serverKey(projectId: string, language: LSPLanguage): string {
  return `${projectId}:${language}`;
}

function getContentLength(header: string): number | null {
  const match = header.match(/Content-Length:\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function parseMessagesFromBuffer(buffer: Buffer): { messages: string[]; remaining: Buffer } {
  const messages: string[] = [];
  let remaining = buffer;

  while (true) {
    const headerEndStr = "\r\n\r\n";
    const headerEndIdx = remaining.indexOf(headerEndStr);
    if (headerEndIdx === -1) break;

    const header = remaining.subarray(0, headerEndIdx).toString("utf8");
    const contentLength = getContentLength(header);
    if (contentLength === null) break;

    const bodyStart = headerEndIdx + 4;
    if (remaining.length < bodyStart + contentLength) break;

    const body = remaining.subarray(bodyStart, bodyStart + contentLength).toString("utf8");
    messages.push(body);
    remaining = remaining.subarray(bodyStart + contentLength);
  }

  return { messages, remaining };
}

function encodeMessage(content: string): string {
  const byteLength = Buffer.byteLength(content, "utf8");
  return `Content-Length: ${byteLength}\r\n\r\n${content}`;
}

export function startLSPServer(
  projectId: string,
  language: LSPLanguage,
  rootPath: string,
  onMessage: (data: string) => void,
): boolean {
  const key = serverKey(projectId, language);

  const existing = lspServers.get(key);
  if (existing && !existing.shutdownRequested) {
    existing.onMessage = onMessage;
    return true;
  }

  const config = LSP_COMMANDS[language];
  if (!config) {
    log(`LSP: Unknown language ${language}`, "lsp");
    return false;
  }

  // Attempt auto-install via lspSetup if the binary isn't found
  ensureLspInstalled(language);

  try {
    const pythonBin = "/home/runner/workspace/.pythonlibs/bin";
    const existingPath = process.env.PATH || "/usr/local/bin:/usr/bin:/bin";
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      HOME: process.env.HOME || "/home/runner",
      PATH: `${pythonBin}:${existingPath}`,
    };

    const proc = spawn(config.command, config.args, {
      cwd: rootPath || process.env.HOME || "/home/runner",
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const instance: LSPServerInstance = {
      process: proc,
      language,
      projectId,
      rootUri: `file://${rootPath}`,
      startedAt: Date.now(),
      restartCount: 0,
      maxRestarts: 3,
      onMessage,
      pendingBuffer: Buffer.alloc(0),
      initialized: false,
      shutdownRequested: false,
    };

    proc.stdout?.on("data", (chunk: Buffer) => {
      instance.pendingBuffer = Buffer.concat([instance.pendingBuffer, chunk]);
      const { messages, remaining } = parseMessagesFromBuffer(instance.pendingBuffer);
      instance.pendingBuffer = remaining;

      for (const msg of messages) {
        try {
          if (instance.onMessage) {
            instance.onMessage(msg);
          }
        } catch (err) {
          log(`LSP: Error processing message for ${key}: ${err}`, "lsp");
        }
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8").trim();
      if (text) {
        log(`LSP stderr [${key}]: ${text.substring(0, 200)}`, "lsp");
      }
    });

    proc.on("error", (err) => {
      log(`LSP: Process error for ${key}: ${err.message}`, "lsp");
      handleServerCrash(key, instance);
    });

    proc.on("exit", (code, signal) => {
      log(`LSP: Process exited for ${key} (code=${code}, signal=${signal})`, "lsp");
      if (!instance.shutdownRequested) {
        handleServerCrash(key, instance);
      } else {
        lspServers.delete(key);
      }
    });

    lspServers.set(key, instance);
    log(`LSP: Started ${language} server for project ${projectId}`, "lsp");
    return true;
  } catch (err) {
    log(`LSP: Failed to start ${language} server: ${err}`, "lsp");
    return false;
  }
}

type CrashCallback = (projectId: string, language: LSPLanguage, restarting: boolean) => void;
let crashCallback: CrashCallback | null = null;

export function onLSPCrash(callback: CrashCallback): void {
  crashCallback = callback;
}

function handleServerCrash(key: string, instance: LSPServerInstance): void {
  lspServers.delete(key);
  instance.initialized = false;

  if (instance.shutdownRequested) return;

  const willRestart = instance.restartCount < instance.maxRestarts;

  if (crashCallback) {
    crashCallback(instance.projectId, instance.language, willRestart);
  }

  if (willRestart) {
    const delay = Math.min(1000 * Math.pow(2, instance.restartCount), 10000);
    log(`LSP: Scheduling restart for ${key} in ${delay}ms (attempt ${instance.restartCount + 1}/${instance.maxRestarts})`, "lsp");

    setTimeout(() => {
      if (instance.onMessage) {
        const rootPath = instance.rootUri.replace("file://", "");
        const success = startLSPServer(instance.projectId, instance.language, rootPath, instance.onMessage!);
        if (success) {
          const newInstance = lspServers.get(key);
          if (newInstance) {
            newInstance.restartCount = instance.restartCount + 1;
          }
        }
      }
    }, delay);
  } else {
    log(`LSP: Max restarts reached for ${key}, giving up`, "lsp");
  }
}

export function sendToLSP(projectId: string, language: LSPLanguage, message: string): boolean {
  const key = serverKey(projectId, language);
  const instance = lspServers.get(key);

  if (!instance || instance.shutdownRequested) {
    return false;
  }

  try {
    const encoded = encodeMessage(message);
    instance.process.stdin?.write(encoded);
    return true;
  } catch (err) {
    log(`LSP: Failed to send message to ${key}: ${err}`, "lsp");
    return false;
  }
}

export function stopLSPServer(projectId: string, language: LSPLanguage): void {
  const key = serverKey(projectId, language);
  const instance = lspServers.get(key);

  if (!instance) return;

  instance.shutdownRequested = true;
  instance.onMessage = null;

  try {
    const shutdownMsg = JSON.stringify({
      jsonrpc: "2.0",
      id: "__shutdown__",
      method: "shutdown",
      params: null,
    });
    const encoded = encodeMessage(shutdownMsg);
    instance.process.stdin?.write(encoded);

    setTimeout(() => {
      try {
        const exitMsg = JSON.stringify({
          jsonrpc: "2.0",
          method: "exit",
          params: null,
        });
        instance.process.stdin?.write(encodeMessage(exitMsg));
      } catch {}

      setTimeout(() => {
        try {
          if (!instance.process.killed) {
            instance.process.kill("SIGTERM");
          }
        } catch {}
        lspServers.delete(key);
      }, 2000);
    }, 1000);
  } catch {
    try {
      instance.process.kill("SIGKILL");
    } catch {}
    lspServers.delete(key);
  }

  log(`LSP: Stopping ${language} server for project ${projectId}`, "lsp");
}

export function stopAllLSPServers(projectId: string): void {
  const languages: LSPLanguage[] = ["typescript", "javascript", "python", "go"];
  for (const lang of languages) {
    stopLSPServer(projectId, lang);
  }
}

export function isLSPRunning(projectId: string, language: LSPLanguage): boolean {
  const key = serverKey(projectId, language);
  const instance = lspServers.get(key);
  return !!instance && !instance.shutdownRequested;
}

export function isLSPInitialized(projectId: string, language: LSPLanguage): boolean {
  const key = serverKey(projectId, language);
  const instance = lspServers.get(key);
  return !!instance && instance.initialized && !instance.shutdownRequested;
}

export function markLSPInitialized(projectId: string, language: LSPLanguage): void {
  const key = serverKey(projectId, language);
  const instance = lspServers.get(key);
  if (instance) {
    instance.initialized = true;
  }
}

export function getLSPStatus(projectId: string): Record<LSPLanguage, boolean> {
  return {
    typescript: isLSPRunning(projectId, "typescript"),
    javascript: isLSPRunning(projectId, "javascript"),
    python: isLSPRunning(projectId, "python"),
    go: isLSPRunning(projectId, "go"),
  };
}

export function setLSPMessageHandler(
  projectId: string,
  language: LSPLanguage,
  handler: (data: string) => void,
): void {
  const key = serverKey(projectId, language);
  const instance = lspServers.get(key);
  if (instance) {
    instance.onMessage = handler;
  }
}

export function getActiveLSPCount(): number {
  return lspServers.size;
}

export function detectProjectLanguage(filename: string): LSPLanguage | null {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "py":
    case "pyw":
      return "python";
    case "go":
      return "go";
    default:
      return null;
  }
}
