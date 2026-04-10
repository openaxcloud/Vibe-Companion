import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';

// Minimal in-memory workspace manager for testing
interface Workspace {
  id: string;
  name: string;
  path: string;
  createdAt: number;
}

class LocalWorkspaceManager {
  private workspaces = new Map<string, Workspace>();
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  create(id: string, name: string): Workspace {
    if (this.workspaces.has(id)) {
      throw new Error(`Workspace ${id} already exists`);
    }
    const ws: Workspace = {
      id,
      name,
      path: path.join(this.baseDir, id),
      createdAt: Date.now(),
    };
    this.workspaces.set(id, ws);
    return ws;
  }

  get(id: string): Workspace | null {
    return this.workspaces.get(id) ?? null;
  }

  list(): Workspace[] {
    return Array.from(this.workspaces.values());
  }

  delete(id: string): boolean {
    return this.workspaces.delete(id);
  }

  getPath(id: string): string | null {
    const ws = this.workspaces.get(id);
    return ws ? ws.path : null;
  }
}

describe('LocalWorkspaceManager', () => {
  let manager: LocalWorkspaceManager;
  const baseDir = path.join(os.tmpdir(), 'test-workspaces');

  beforeEach(() => {
    manager = new LocalWorkspaceManager(baseDir);
  });

  it('creates a workspace with correct path', () => {
    const ws = manager.create('proj-1', 'My Project');
    expect(ws.id).toBe('proj-1');
    expect(ws.name).toBe('My Project');
    expect(ws.path).toBe(path.join(baseDir, 'proj-1'));
  });

  it('retrieves an existing workspace', () => {
    manager.create('proj-2', 'Second');
    const ws = manager.get('proj-2');
    expect(ws).not.toBeNull();
    expect(ws?.name).toBe('Second');
  });

  it('returns null for unknown workspace', () => {
    expect(manager.get('nonexistent')).toBeNull();
  });

  it('lists all workspaces', () => {
    manager.create('a', 'A');
    manager.create('b', 'B');
    const list = manager.list();
    expect(list).toHaveLength(2);
    expect(list.map(w => w.id)).toContain('a');
    expect(list.map(w => w.id)).toContain('b');
  });

  it('throws on duplicate creation', () => {
    manager.create('dup', 'Dup');
    expect(() => manager.create('dup', 'Dup2')).toThrow('already exists');
  });

  it('deletes a workspace', () => {
    manager.create('del-me', 'Delete Me');
    expect(manager.delete('del-me')).toBe(true);
    expect(manager.get('del-me')).toBeNull();
  });

  it('returns false when deleting nonexistent workspace', () => {
    expect(manager.delete('ghost')).toBe(false);
  });

  it('getPath returns correct path', () => {
    manager.create('path-test', 'Path Test');
    expect(manager.getPath('path-test')).toBe(path.join(baseDir, 'path-test'));
  });

  it('getPath returns null for missing workspace', () => {
    expect(manager.getPath('missing')).toBeNull();
  });
});
