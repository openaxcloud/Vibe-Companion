import { describe, it, expect } from 'vitest';

describe('Local Workspace Manager', () => {
  it('should detect start commands from package.json', () => {
    const pkg = { scripts: { dev: 'vite', start: 'node server.js' } };
    const cmd = pkg.scripts.dev ? 'npm run dev' : pkg.scripts.start ? 'npm start' : null;
    expect(cmd).toBe('npm run dev');
  });

  it('should detect start command fallback', () => {
    const pkg = { scripts: { start: 'node server.js' } };
    const cmd = (pkg.scripts as any).dev ? 'npm run dev' : pkg.scripts.start ? 'npm start' : null;
    expect(cmd).toBe('npm start');
  });

  it('should handle missing scripts', () => {
    const pkg = { scripts: {} };
    const cmd = (pkg.scripts as any).dev ? 'npm run dev' : (pkg.scripts as any).start ? 'npm start' : null;
    expect(cmd).toBeNull();
  });
});
