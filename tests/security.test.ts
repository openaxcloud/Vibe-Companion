import { describe, it, expect } from 'vitest';

const DANGEROUS_COMMANDS = [
  'rm -rf /', 'rm -rf /*', 'shutdown -h now', 'reboot',
  'mkfs.ext4 /dev/sda', 'dd if=/dev/zero of=/dev/sda',
  ':(){ :|:& };:', 'chmod -R 777 /', 'kill -9 1'
];

const SAFE_COMMANDS = [
  'npm install', 'npm run dev', 'npm test', 'ls -la',
  'node index.js', 'python3 app.py', 'cat package.json',
  'mkdir src', 'echo hello'
];

function isDangerousCommand(cmd: string): boolean {
  const blocked = ['rm -rf /', 'rm -rf /*', 'shutdown', 'reboot', 'mkfs', 'dd if=/dev', ':()', 'chmod -R 777 /', 'kill -9 1', 'format c:'];
  return blocked.some(b => cmd.includes(b));
}

describe('Command Security', () => {
  it('blocks all dangerous commands', () => {
    for (const cmd of DANGEROUS_COMMANDS) {
      expect(isDangerousCommand(cmd)).toBe(true);
    }
  });

  it('allows safe commands', () => {
    for (const cmd of SAFE_COMMANDS) {
      expect(isDangerousCommand(cmd)).toBe(false);
    }
  });
});
