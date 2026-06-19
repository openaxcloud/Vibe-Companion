/**
 * OAuth + RBAC + invite flow — end-to-end spec
 *
 * What this tests:
 * 1. User A (owner) creates a project via the API.
 * 2. User A sends a JWT-signed invite to User B (editor role).
 * 3. User B accepts the invite → is added to project_collaborators.
 * 4. User B can write to the project (file create returns 201).
 * 5. User C (no invite) cannot write (403/404).
 *
 * Scope: API-level only (no OAuth browser redirect — OAuth callbacks
 * are covered by unit tests / manual smoke testing with real secrets).
 *
 * Run precondition: BASE_URL must point to a running dev server
 * (npm run dev) and reset-e2e-admin must have been executed.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const SUFFIX = Date.now();
const USER_B_EMAIL = `e2e-user-b-${SUFFIX}@test-rbac.local`;
const USER_C_EMAIL = `e2e-user-c-${SUFFIX}@test-rbac.local`;
const STRONG_PASS = 'Test@RBAC1!';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password';

// ---------- helpers ----------

async function getCsrf(request: any): Promise<string | null> {
  const r = await request.get(`${BASE_URL}/api/csrf-token`);
  if (!r.ok()) return null;
  const body = await r.json().catch(() => null);
  return body?.csrfToken || body?.token || null;
}

async function loginAs(request: any, email: string, password: string): Promise<void> {
  const csrf = await getCsrf(request);
  const r = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password },
    headers: csrf ? { 'x-csrf-token': csrf } : {},
  });
  expect(r.ok(), `login failed for ${email}: ${r.status()} ${await r.text()}`).toBeTruthy();
}

async function register(request: any, email: string, password: string): Promise<void> {
  const csrf = await getCsrf(request);
  const username = `user_${email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 18)}`;
  const r = await request.post(`${BASE_URL}/api/auth/register`, {
    data: { email, password, username, displayName: username },
    headers: csrf ? { 'x-csrf-token': csrf } : {},
  });
  // 201 = created, 409 = already exists (idempotent for re-runs)
  expect([201, 409], `register failed for ${email}: ${r.status()} ${await r.text()}`).toContain(r.status());
}

async function createProject(request: any): Promise<string> {
  const csrf = await getCsrf(request);
  const r = await request.post(`${BASE_URL}/api/projects`, {
    data: { name: `rbac-test-${SUFFIX}`, language: 'javascript', visibility: 'private' },
    headers: csrf ? { 'x-csrf-token': csrf } : {},
  });
  expect(r.ok(), `createProject failed: ${r.status()} ${await r.text()}`).toBeTruthy();
  const body = await r.json();
  const id = String(body.id || body.project?.id);
  expect(id, 'project id must be returned').toBeTruthy();
  return id;
}

async function sendInvite(request: any, projectId: string, email: string, role: 'editor' | 'viewer' = 'editor'): Promise<string> {
  const csrf = await getCsrf(request);
  const r = await request.post(`${BASE_URL}/api/projects/${projectId}/invites`, {
    data: { email, role },
    headers: csrf ? { 'x-csrf-token': csrf } : {},
  });
  expect(r.ok(), `sendInvite failed: ${r.status()} ${await r.text()}`).toBeTruthy();
  const body = await r.json();
  expect(body.token, 'invite token must be returned').toBeTruthy();
  return body.token as string;
}

async function acceptInviteByToken(request: any, token: string): Promise<void> {
  const csrf = await getCsrf(request);
  const r = await request.post(`${BASE_URL}/api/invites/by-token/${token}/accept`, {
    headers: csrf ? { 'x-csrf-token': csrf } : {},
  });
  expect(r.ok(), `acceptInvite failed: ${r.status()} ${await r.text()}`).toBeTruthy();
}

async function createFile(request: any, projectId: string): Promise<number> {
  const csrf = await getCsrf(request);
  const r = await request.post(`${BASE_URL}/api/projects/${projectId}/files`, {
    data: { filename: `rbac-test-${SUFFIX}.txt`, content: 'hello rbac' },
    headers: csrf ? { 'x-csrf-token': csrf } : {},
  });
  return r.status();
}

// ---------- tests ----------

test.describe('RBAC invite flow', () => {
  // Use separate browser contexts so each user has an independent cookie jar
  test('owner can invite, editor can write, viewer cannot, stranger cannot', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const ctxC = await browser.newContext();

    const reqA = ctxA.request;
    const reqB = ctxB.request;
    const reqC = ctxC.request;

    // 1. Register User B and User C (may already exist on re-runs)
    await register(reqB, USER_B_EMAIL, STRONG_PASS);
    await register(reqC, USER_C_EMAIL, STRONG_PASS);

    // 2. User A (admin) logs in and creates a project
    await loginAs(reqA, ADMIN_EMAIL, ADMIN_PASSWORD);
    const projectId = await createProject(reqA);

    // 3. User A invites User B as editor
    const inviteToken = await sendInvite(reqA, projectId, USER_B_EMAIL, 'editor');

    // 4. User B logs in and accepts the invite
    await loginAs(reqB, USER_B_EMAIL, STRONG_PASS);

    // 4a. GET /api/invites/by-token/:token must return project info without auth (public preview)
    const previewRes = await ctxB.request.get(`${BASE_URL}/api/invites/by-token/${inviteToken}`);
    expect(previewRes.ok(), `invite preview GET failed: ${previewRes.status()}`).toBeTruthy();
    const preview = await previewRes.json();
    expect(preview.role).toBe('editor');
    expect(preview.projectId).toBe(projectId);

    // 4b. Accept the invite
    await acceptInviteByToken(reqB, inviteToken);

    // 5. User B (editor) should be able to create a file
    const statusB = await createFile(reqB, projectId);
    expect(statusB, 'editor should be able to create a file (201)').toBe(201);

    // 6. User C (no invite) should NOT be able to write
    await loginAs(reqC, USER_C_EMAIL, STRONG_PASS);
    const statusC = await createFile(reqC, projectId);
    expect([403, 404], `stranger must be denied (got ${statusC})`).toContain(statusC);

    // 7. Verify User B sees the project in /api/projects/collaborated
    const collabRes = await reqB.get(`${BASE_URL}/api/projects/collaborated`);
    expect(collabRes.ok()).toBeTruthy();
    const collaborated = await collabRes.json();
    const found = (collaborated as any[]).find((p: any) => String(p.id) === String(projectId));
    expect(found, 'collaborated project should appear in /api/projects/collaborated').toBeTruthy();
    expect(found.userRole).toBe('editor');

    await ctxA.close();
    await ctxB.close();
    await ctxC.close();
  });

  test('viewer role cannot write files', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();

    const USER_VIEWER_EMAIL = `e2e-viewer-${SUFFIX}@test-rbac.local`;
    await register(ctxB.request, USER_VIEWER_EMAIL, STRONG_PASS);

    await loginAs(ctxA.request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const projectId = await createProject(ctxA.request);

    const viewerToken = await sendInvite(ctxA.request, projectId, USER_VIEWER_EMAIL, 'viewer');

    await loginAs(ctxB.request, USER_VIEWER_EMAIL, STRONG_PASS);
    await acceptInviteByToken(ctxB.request, viewerToken);

    const status = await createFile(ctxB.request, projectId);
    expect([403, 404], `viewer must be denied write (got ${status})`).toContain(status);

    await ctxA.close();
    await ctxB.close();
  });

  test('duplicate invite returns 409', async ({ browser }) => {
    const ctxA = await browser.newContext();
    await loginAs(ctxA.request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const projectId = await createProject(ctxA.request);

    const DUPE_EMAIL = `e2e-dupe-${SUFFIX}@test-rbac.local`;
    await sendInvite(ctxA.request, projectId, DUPE_EMAIL, 'editor');

    // Second invite to same email must be 409
    const csrf = await getCsrf(ctxA.request);
    const r = await ctxA.request.post(`${BASE_URL}/api/projects/${projectId}/invites`, {
      data: { email: DUPE_EMAIL, role: 'editor' },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(r.status()).toBe(409);

    await ctxA.close();
  });

  test('invite token GET returns invite metadata', async ({ request }) => {
    // Login as admin and create project + invite
    await loginAs(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const projectId = await createProject(request);
    const META_EMAIL = `e2e-meta-${SUFFIX}@test-rbac.local`;
    const token = await sendInvite(request, projectId, META_EMAIL, 'viewer');

    // Unauthenticated GET must return project name + role
    const r = await request.get(`${BASE_URL}/api/invites/by-token/${token}`);
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.role).toBe('viewer');
    expect(typeof body.projectName).toBe('string');
  });
});
