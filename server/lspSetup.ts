import { spawn, execSync } from 'child_process';

const LSP_SERVERS: Record<string, { npm: string; bin: string; args: string[] }> = {
  typescript: { npm: 'typescript-language-server', bin: 'typescript-language-server', args: ['--stdio'] },
  javascript: { npm: 'typescript-language-server', bin: 'typescript-language-server', args: ['--stdio'] },
  python: { npm: 'pyright', bin: 'pyright-langserver', args: ['--stdio'] },
  json: { npm: 'vscode-json-languageserver', bin: 'vscode-json-languageserver', args: ['--stdio'] },
  html: { npm: 'vscode-html-languageserver-bin', bin: 'html-languageserver', args: ['--stdio'] },
  css: { npm: 'vscode-css-languageserver-bin', bin: 'css-languageserver', args: ['--stdio'] },
};

export function ensureLspInstalled(language: string): boolean {
  const config = LSP_SERVERS[language];
  if (!config) return false;
  try {
    execSync(`which ${config.bin}`, { stdio: 'ignore' });
    return true;
  } catch {
    try {
      console.log(`[lsp] Installing ${config.npm}...`);
      execSync(`npm install -g ${config.npm}`, { stdio: 'ignore', timeout: 60000 });
      return true;
    } catch (e) {
      console.error(`[lsp] Failed to install ${config.npm}:`, e);
      return false;
    }
  }
}

export function startLspServer(language: string, workspacePath: string) {
  const config = LSP_SERVERS[language];
  if (!config) return null;
  ensureLspInstalled(language);
  try {
    const proc = spawn(config.bin, config.args, {
      cwd: workspacePath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_PATH: workspacePath + '/node_modules' }
    });
    proc.on('error', (err) => console.error(`[lsp] ${language} server error:`, err));
    proc.on('exit', (code) => console.log(`[lsp] ${language} server exited with code ${code}`));
    return proc;
  } catch (e) {
    console.error(`[lsp] Failed to start ${language} server:`, e);
    return null;
  }
}

export function getLspLanguage(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', json: 'json', html: 'html', css: 'css', scss: 'css'
  };
  return map[ext || ''] || null;
}

export { LSP_SERVERS };
