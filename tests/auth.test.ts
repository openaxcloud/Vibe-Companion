import { describe, it, expect, vi, beforeEach } from 'vitest';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

interface Session {
  userId: string;
  token: string;
  expiresAt: number;
}

const sessions = new Map<string, Session>();

function createSession(user: User): Session {
  const token = `token_${user.id}_${Date.now()}`;
  const session: Session = {
    userId: user.id,
    token,
    expiresAt: Date.now() + 3600 * 1000,
  };
  sessions.set(token, session);
  return session;
}

function validateSession(token: string): Session | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function revokeSession(token: string): void {
  sessions.delete(token);
}

function hasPermission(user: User, action: string): boolean {
  if (user.role === 'admin') return true;
  const userActions = ['read:own', 'write:own', 'delete:own'];
  return userActions.includes(action);
}

describe('Session management', () => {
  beforeEach(() => {
    sessions.clear();
  });

  it('creates a valid session', () => {
    const user: User = { id: 'u1', email: 'test@test.com', role: 'user' };
    const session = createSession(user);
    expect(session.userId).toBe('u1');
    expect(session.token).toBeTruthy();
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  it('validates an active session', () => {
    const user: User = { id: 'u2', email: 'a@b.com', role: 'user' };
    const session = createSession(user);
    const validated = validateSession(session.token);
    expect(validated).not.toBeNull();
    expect(validated?.userId).toBe('u2');
  });

  it('rejects unknown token', () => {
    expect(validateSession('bogus_token')).toBeNull();
  });

  it('invalidates after revocation', () => {
    const user: User = { id: 'u3', email: 'c@d.com', role: 'user' };
    const session = createSession(user);
    revokeSession(session.token);
    expect(validateSession(session.token)).toBeNull();
  });

  it('rejects expired sessions', () => {
    const user: User = { id: 'u4', email: 'e@f.com', role: 'user' };
    const session = createSession(user);
    // Manually expire
    sessions.set(session.token, { ...session, expiresAt: Date.now() - 1 });
    expect(validateSession(session.token)).toBeNull();
  });
});

describe('Authorization / permissions', () => {
  const admin: User = { id: 'a1', email: 'admin@test.com', role: 'admin' };
  const regular: User = { id: 'u1', email: 'user@test.com', role: 'user' };

  it('admin can perform any action', () => {
    expect(hasPermission(admin, 'read:any')).toBe(true);
    expect(hasPermission(admin, 'delete:any')).toBe(true);
  });

  it('user can read/write/delete own resources', () => {
    expect(hasPermission(regular, 'read:own')).toBe(true);
    expect(hasPermission(regular, 'write:own')).toBe(true);
    expect(hasPermission(regular, 'delete:own')).toBe(true);
  });

  it('user cannot access others resources', () => {
    expect(hasPermission(regular, 'read:any')).toBe(false);
    expect(hasPermission(regular, 'delete:any')).toBe(false);
  });
});
