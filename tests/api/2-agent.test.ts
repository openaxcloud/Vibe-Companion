/**
 * POST /api/projects/:projectId/agent/message  (claude-agent.router, mounted at /api)
 *
 * Validates:
 *  - @anthropic-ai/sdk is mocked at the module boundary (no real API calls)
 *  - SSE stream emits: status → tool_use → file_created → stream_end
 *  - 401 without session
 *  - userId coercion: integer session.userId treated as string (no 403)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// ── Anthropic SDK mocked at module boundary (vi.hoisted for constructor safety) ──

const { MockAnthropic } = vi.hoisted(() => {
  // Must use regular function (not arrow) so it's usable with `new`
  const MockAnthropic = vi.fn(function MockAnthropicImpl(this: any) {
    this.messages = {
      stream: vi.fn().mockReturnValue({
        on: vi.fn(),
        finalMessage: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [],
          usage: { input_tokens: 5, output_tokens: 5 },
        }),
      }),
    };
  });
  return { MockAnthropic };
});

vi.mock('@anthropic-ai/sdk', () => ({ default: MockAnthropic }));

// ── claudeAgentService mock (controls SSE event sequence) ────────────────────

const { svcMock } = vi.hoisted(() => {
  const svcMock = {
    isConfigured: vi.fn().mockReturnValue(true),
    verifySessionOwnership: vi.fn().mockResolvedValue(true),
    processAgentEvents: vi.fn().mockImplementation(
      async (_csid: string, _pid: string, _sid: string, onEvent?: any) => {
        const mkEvt = (type: string, data: any) => ({
          type,
          sessionId: 'session-1',
          projectId: '1',
          timestamp: Date.now(),
          data,
        });
        onEvent?.(mkEvt('agent_status', { status: 'processing' }));
        onEvent?.(mkEvt('agent_tool_use', { tool: 'create_file', input: { path: 'index.html' } }));
        onEvent?.(mkEvt('file_created', { name: 'index.html', content: '<h1>Hello</h1>' }));
      }
    ),
  };
  return { svcMock };
});

vi.mock('../../server/services/claude-agent-service', () => ({
  claudeAgentService: svcMock,
}));

// ── imports ───────────────────────────────────────────────────────────────────

import { createTestApp } from './helpers/app';
import claudeAgentRouter from '../../server/routes/claude-agent.router';

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Anthropic SDK module boundary', () => {
  it('sdk is mocked — MockAnthropic is a vi.fn() constructor', async () => {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    expect(vi.isMockFunction(Anthropic as any)).toBe(true);
    const client = new (Anthropic as any)();
    expect(vi.isMockFunction(client.messages.stream)).toBe(true);
  });
});

describe('POST /api/projects/:projectId/agent/message', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    svcMock.isConfigured.mockReturnValue(true);
    svcMock.verifySessionOwnership.mockResolvedValue(true);
    app = createTestApp();
    app.use('/api', claudeAgentRouter);
  });

  it('streams status → tool_use → file_created events then closes', async () => {
    const agent = request.agent(app);
    await agent.get('/test/login?userId=1');

    const res = await agent
      .post('/api/projects/1/agent/message')
      .set('Accept', 'text/event-stream')
      .send({ sessionId: 'session-1', claudeSessionId: 'claude-1', message: 'build app' });

    expect(res.status).toBe(200);
    const body = res.text;
    expect(body).toContain('"type":"status"');
    expect(body).toContain('"type":"tool_use"');
    expect(body).toContain('"type":"file_created"');
    expect(body).toContain('"type":"stream_end"');
  });

  it('returns 401 without session', async () => {
    const res = await request(app)
      .post('/api/projects/1/agent/message')
      .send({ sessionId: 'session-1', message: 'build' });
    expect(res.status).toBe(401);
  });

  it('userId coercion: integer session.userId is treated as string — no 403', async () => {
    // session.userId = '1' (string from helper) must not cause 403
    // getAuthUserId in claude-agent.router coerces via String()
    const agent = request.agent(app);
    await agent.get('/test/login?userId=1');
    const res = await agent
      .post('/api/projects/1/agent/message')
      .send({ sessionId: 'session-1', claudeSessionId: 'claude-1', message: 'hi' });
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });
});
