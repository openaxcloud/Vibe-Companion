// Auto-detect and start LSP servers for project languages
// TypeScript: typescript-language-server
// Python: pyright or pylsp
// JSON: vscode-json-languageserver

import { spawn, execSync } from "child_process";

export const LSP_SERVERS: Record<string, { npm: string; bin: string; args: string[] }> = {
  typescript: {
    npm: "typescript-language-server",
    bin: "typescript-language-server",
    args: ["--stdio"],
  },
  javascript: {
    npm: "typescript-language-server",
    bin: "typescript-language-server",
    args: ["--stdio"],
  },
  python: {
    npm: "pyright",
    bin: "pyright-langserver",
    args: ["--stdio"],
  },
  json: {
    npm: "vscode-json-languageserver",
    bin: "vscode-json-languageserver",
    args: ["--stdio"],
  },
  css: {
    npm: "vscode-css-languageservice",
    bin: "css-languageserver",
    args: ["--stdio"],
  },
  html: {
    npm: "vscode-html-languageserver",
    bin: "html-languageserver",
    args: ["--stdio"],
  },
};

export function ensureLspInstalled(language: string): boolean {
  const config = LSP_SERVERS[language];
  if (!config) return false;
  try {
    execSync(`which ${config.bin}`, { stdio: "ignore" });
    return true;
  } catch {
    try {
      execSync(`npm install -g ${config.npm}`, { stdio: "ignore", timeout: 60000 });
      return true;
    } catch (e) {
      console.error(`Failed to install LSP for ${language}:`, e);
      return false;
    }
  }
}

export function startLspServer(language: string, workspacePath: string) {
  const config = LSP_SERVERS[language];
  if (!config) return null;
  ensureLspInstalled(language);
  return spawn(config.bin, config.args, {
    cwd: workspacePath,
    stdio: ["pipe", "pipe", "pipe"],
  });
}
