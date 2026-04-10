import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { db } from '../db';
import { files, projects, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { AgentToolFrameworkService } from '../services/agent-tool-framework.service';
import { syncFileToDisc, getProjectWorkspacePath } from '../utils/project-fs-sync';
import * as fs from 'fs';
import * as path from 'path';

describe('Environment File Persistence - E2E Tests', () => {
  let service: AgentToolFrameworkService;
  let testProjectId: number;
  let testUserId: number;

  beforeAll(async () => {
    service = new AgentToolFrameworkService();

    const [user] = await db.insert(users).values({
      username: `env_test_user_${Date.now()}`,
      password: 'test_hashed_password',
      email: `env_test_${Date.now()}@test.com`,
    }).returning();
    testUserId = user.id;

    const [project] = await db.insert(projects).values({
      name: `env_test_project_${Date.now()}`,
      ownerId: testUserId,
      visibility: 'private',
    }).returning();
    testProjectId = project.id;
  });

  afterAll(async () => {
    await db.delete(files).where(eq(files.projectId, testProjectId));
    await db.delete(projects).where(eq(projects.id, testProjectId));
    await db.delete(users).where(eq(users.id, testUserId));

    const projectDir = getProjectWorkspacePath(testProjectId);
    try {
      fs.rmSync(projectDir, { recursive: true, force: true });
    } catch (err: any) { console.error("[catch]", err?.message || err);}
  });

  beforeEach(async () => {
    await db.delete(files).where(
      and(eq(files.projectId, testProjectId), eq(files.name, '.env'))
    );
  });

  it('should persist a single env variable to the files table', async () => {
    const mergedContent = await service.upsertEnvVariable(testProjectId, '.env', 'DATABASE_URL', 'postgres://localhost/test');

    expect(mergedContent).toContain('DATABASE_URL=postgres://localhost/test');

    const [record] = await db.select()
      .from(files)
      .where(and(eq(files.projectId, testProjectId), eq(files.path, '.env')))
      .limit(1);

    expect(record).toBeDefined();
    expect(record.content).toContain('DATABASE_URL=postgres://localhost/test');
    expect(record.name).toBe('.env');
    expect(record.type).toBe('env');
  });

  it('should merge multiple env variables atomically', async () => {
    await service.upsertEnvVariable(testProjectId, '.env', 'KEY_A', 'value_a');
    await service.upsertEnvVariable(testProjectId, '.env', 'KEY_B', 'value_b');
    const merged = await service.upsertEnvVariable(testProjectId, '.env', 'KEY_C', 'value_c');

    expect(merged).toContain('KEY_A=value_a');
    expect(merged).toContain('KEY_B=value_b');
    expect(merged).toContain('KEY_C=value_c');

    const [record] = await db.select()
      .from(files)
      .where(and(eq(files.projectId, testProjectId), eq(files.path, '.env')))
      .limit(1);

    expect(record.content).toContain('KEY_A=value_a');
    expect(record.content).toContain('KEY_B=value_b');
    expect(record.content).toContain('KEY_C=value_c');
  });

  it('should update an existing env variable without losing others', async () => {
    await service.upsertEnvVariable(testProjectId, '.env', 'PORT', '3000');
    await service.upsertEnvVariable(testProjectId, '.env', 'HOST', 'localhost');

    const updated = await service.upsertEnvVariable(testProjectId, '.env', 'PORT', '8080');

    expect(updated).toContain('PORT=8080');
    expect(updated).toContain('HOST=localhost');
    expect(updated).not.toContain('PORT=3000');
  });

  it('should persist a full env file via upsertEnvFileContent', async () => {
    const content = 'NODE_ENV=production\nAPI_KEY=secret123\nPORT=5000\n';
    await service.upsertEnvFileContent(testProjectId, '.env', content);

    const [record] = await db.select()
      .from(files)
      .where(and(eq(files.projectId, testProjectId), eq(files.path, '.env')))
      .limit(1);

    expect(record).toBeDefined();
    expect(record.content).toBe(content);
  });

  it('should sync env file to disk', async () => {
    const content = 'DISK_TEST=hello_world\n';
    await service.upsertEnvFileContent(testProjectId, '.env', content);
    await syncFileToDisc(testProjectId, '.env', content);

    const projectDir = getProjectWorkspacePath(testProjectId);
    const envPath = path.join(projectDir, '.env');
    const diskContent = fs.readFileSync(envPath, 'utf8');

    expect(diskContent).toBe(content);
  });

  it('should survive a simulated restart by reading from DB', async () => {
    await service.upsertEnvVariable(testProjectId, '.env', 'RESTART_KEY', 'persist_me');

    const [dbRecord] = await db.select()
      .from(files)
      .where(and(eq(files.projectId, testProjectId), eq(files.path, '.env')))
      .limit(1);

    expect(dbRecord).toBeDefined();
    expect(dbRecord.content).toContain('RESTART_KEY=persist_me');

    const projectDir = getProjectWorkspacePath(testProjectId);
    const envPath = path.join(projectDir, '.env');
    try { fs.unlinkSync(envPath); } catch (err: any) { console.error("[catch]", err?.message || err);}

    await syncFileToDisc(testProjectId, '.env', dbRecord.content || '');
    const restored = fs.readFileSync(envPath, 'utf8');
    expect(restored).toContain('RESTART_KEY=persist_me');
  });

  it('should handle values with spaces and special characters', async () => {
    await service.upsertEnvVariable(testProjectId, '.env', 'GREETING', 'hello world');
    const merged = await service.upsertEnvVariable(testProjectId, '.env', 'COMMENT_VAL', 'value # with hash');

    expect(merged).toContain('GREETING="hello world"');
    expect(merged).toContain('COMMENT_VAL="value # with hash"');
  });

  it('should handle concurrent writes to an initially absent env file without losing keys', async () => {
    const results = await Promise.all([
      service.upsertEnvVariable(testProjectId, '.env', 'CONC_A', 'va'),
      service.upsertEnvVariable(testProjectId, '.env', 'CONC_B', 'vb'),
      service.upsertEnvVariable(testProjectId, '.env', 'CONC_C', 'vc'),
    ]);

    const [record] = await db.select()
      .from(files)
      .where(and(eq(files.projectId, testProjectId), eq(files.path, '.env')))
      .limit(1);

    expect(record).toBeDefined();
    expect(record.content).toContain('CONC_A=va');
    expect(record.content).toContain('CONC_B=vb');
    expect(record.content).toContain('CONC_C=vc');
  });

  it('should support custom env file names like .env.local', async () => {
    const content = await service.upsertEnvVariable(testProjectId, '.env.local', 'LOCAL_KEY', 'local_val');

    const [record] = await db.select()
      .from(files)
      .where(and(eq(files.projectId, testProjectId), eq(files.path, '.env.local')))
      .limit(1);

    expect(record).toBeDefined();
    expect(record.content).toContain('LOCAL_KEY=local_val');

    await db.delete(files).where(eq(files.id, record.id));
  });
});
