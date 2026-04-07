import request, { SuperTest, Test } from 'supertest';
import http from 'http';
import app from '../app';

interface RegisterResponseBody {
  id: string;
  email: string;
  createdAt?: string;
}

interface LoginResponseBody {
  message?: string;
}

interface MeResponseBody {
  id: string;
  email: string;
  createdAt?: string;
}

describe('Auth Flow Integration', () => {
  let server: http.Server;
  let agent: SuperTest<Test>;

  const testUser = {
    email: `auth_test_user_undefined@example.com`,
    password: 'S3cureP@ssw0rd!',
  };

  beforeAll((done) => {
    server = app.listen(0, () => {
      agent = request.agent(server);
      done();
    });
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  it('registers a new user, logs in, sets auth cookie, and verifies /me', async () => {
    // 1. Register user
    const registerRes = await agent
      .post('/auth/register')
      .send(testUser)
      .set('Accept', 'application/json');

    expect(registerRes.status).toBeGreaterThanOrEqual(200);
    expect(registerRes.status).toBeLessThan(300);

    const registerBody = registerRes.body as RegisterResponseBody;
    expect(registerBody).toBeDefined();
    expect(registerBody.id).toBeDefined();
    expect(registerBody.email).toBe(testUser.email);

    // 2. Login
    const loginRes = await agent
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .set('Accept', 'application/json');

    expect(loginRes.status).toBe(200);
    const loginBody = loginRes.body as LoginResponseBody | undefined;
    if (loginBody && loginBody.message) {
      expect(typeof loginBody.message).toBe('string');
    }

    // 3. Check that cookie is set
    const setCookieHeader = loginRes.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    expect(Array.isArray(setCookieHeader)).toBe(true);
    const cookieString = (setCookieHeader as string[]).join(';');
    expect(cookieString.toLowerCase()).toContain('httponly');
    expect(cookieString.toLowerCase()).toContain('path=');
    // Do not assert on secure in test env, but ensure token-like cookie present
    const hasSession =
      /token=/.test(cookieString) ||
      /session=/.test(cookieString) ||
      /auth=/.test(cookieString);
    expect(hasSession).toBe(true);

    // 4. Call /me with the same agent (should include cookie)
    const meRes = await agent.get('/auth/me').set('Accept', 'application/json');

    expect(meRes.status).toBe(200);

    const meBody = meRes.body as MeResponseBody;
    expect(meBody).toBeDefined();
    expect(meBody.id).toBeDefined();
    expect(meBody.email).toBe(testUser.email);
  });

  it('denies access to /me without auth', async () => {
    const anonymous = request(server);

    const res = await anonymous.get('/auth/me').set('Accept', 'application/json');

    expect([401, 403]).toContain(res.status);
  });
});