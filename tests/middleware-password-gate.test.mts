// Regression tests for the passfort password gate wired into middleware.ts.
//
// Verifies the two properties that matter for a preview/staging deployment:
//   1. The gate actually blocks unauthenticated visitors on page routes when
//      PASSFORT_SECRET + PASSFORT_PASSWORD are set, and lets them through
//      once they hold a valid session cookie.
//   2. /api/* is entirely untouched by the gate, regardless of whether it's
//      configured — the RSS proxy, MCP, health checks, and every other API
//      route must stay reachable with no password, both for the dashboard's
//      own client-side fetches and for external integrations that can't
//      submit one.
//
// When PASSFORT_SECRET/PASSFORT_PASSWORD are unset (the default for every
// variant except an explicitly gated preview), the gate is a no-op — see
// middleware-bot-gate.test.mts, which runs with no passfort env vars set at
// all and pins the pre-existing bot-gate behavior unchanged.

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import middleware from '../middleware';

const SECRET = 'a'.repeat(24);
const PASSWORD = 'correct-horse-battery-staple';

const ENV_KEYS = ['PASSFORT_SECRET', 'PASSFORT_PASSWORD', 'PASSFORT_HASH', 'PASSFORT_ENABLED'] as const;
const savedEnv: Record<string, string | undefined> = {};

function setPassfortEnv(overrides: Partial<Record<typeof ENV_KEYS[number], string>> = {}): void {
  process.env.PASSFORT_SECRET = overrides.PASSFORT_SECRET ?? SECRET;
  process.env.PASSFORT_PASSWORD = overrides.PASSFORT_PASSWORD ?? PASSWORD;
  if (overrides.PASSFORT_HASH) process.env.PASSFORT_HASH = overrides.PASSFORT_HASH;
  if (overrides.PASSFORT_ENABLED) process.env.PASSFORT_ENABLED = overrides.PASSFORT_ENABLED;
}

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function getSessionCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/__password_protect=([^;]+)/);
  assert.ok(match, `expected a __password_protect cookie in Set-Cookie, got: ${setCookie}`);
  return match![1];
}

describe('passfort password gate — page routes', () => {
  it('unconfigured (no env vars): does not gate the homepage', async () => {
    const res = await middleware(new Request('https://www.worldmonitor.app/'));
    assert.equal(res, undefined, 'no PASSFORT_SECRET/PASSWORD -> gate is a no-op');
  });

  it('configured: blocks an unauthenticated GET / with a 401 password form', async () => {
    setPassfortEnv();
    const res = await middleware(new Request('https://www.worldmonitor.app/'));
    assert.ok(res instanceof Response, 'expected the gate to intercept the request');
    assert.equal(res.status, 401);
    const body = await res.text();
    assert.match(body, /<form/i, 'expected the password form HTML');
    assert.match(body, /type="password"/i);
  });

  it('configured: blocks an unauthenticated deep link (e.g. /dashboard) the same way', async () => {
    setPassfortEnv();
    const res = await middleware(new Request('https://www.worldmonitor.app/dashboard'));
    assert.ok(res instanceof Response);
    assert.equal(res.status, 401);
  });

  it('configured: rejects a wrong password with a 401 (form re-shown, not a 500)', async () => {
    setPassfortEnv();
    const form = new FormData();
    form.set('password', 'definitely-not-it');
    form.set('return_url', '/');
    const res = await middleware(new Request('https://www.worldmonitor.app/', { method: 'POST', body: form }));
    assert.ok(res instanceof Response);
    assert.equal(res.status, 401);
  });

  it('configured: accepts the correct password, sets a session cookie, and redirects', async () => {
    setPassfortEnv();
    const form = new FormData();
    form.set('password', PASSWORD);
    form.set('return_url', '/');
    const res = await middleware(new Request('https://www.worldmonitor.app/', { method: 'POST', body: form }));
    assert.ok(res instanceof Response);
    assert.equal(res.status, 302);
    const cookie = getSessionCookie(res);
    assert.ok(cookie.length > 0);
  });

  it('configured: a valid session cookie passes the gate through on a subsequent page request', async () => {
    setPassfortEnv();
    const form = new FormData();
    form.set('password', PASSWORD);
    form.set('return_url', '/');
    const loginRes = await middleware(new Request('https://www.worldmonitor.app/', { method: 'POST', body: form }));
    assert.ok(loginRes instanceof Response);
    const cookie = getSessionCookie(loginRes);

    const res = await middleware(new Request('https://www.worldmonitor.app/', {
      headers: { cookie: `__password_protect=${cookie}` },
    }));
    assert.equal(res, undefined, 'a valid session cookie must let the request fall through to the app');
  });

  it('configured: an invalid/forged session cookie is rejected (still gated)', async () => {
    setPassfortEnv();
    const res = await middleware(new Request('https://www.worldmonitor.app/', {
      headers: { cookie: '__password_protect=forged.notasignature' },
    }));
    assert.ok(res instanceof Response);
    assert.equal(res.status, 401);
  });
});

describe('passfort password gate — /api/* is never gated', () => {
  const API_PATHS = [
    '/api/rss-proxy?url=https%3A%2F%2Fexample.com%2Ffeed.xml',
    '/api/health',
    '/api/version',
    '/api/news/v1/list-articles',
    '/api/mcp',
  ];

  for (const path of API_PATHS) {
    it(`${path} passes through with no session cookie even when the gate is configured`, async () => {
      setPassfortEnv();
      const res = await middleware(new Request(`https://www.worldmonitor.app${path}`, {
        headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126.0.0.0 Safari/537.36' },
      }));
      // The pre-existing bot gate still applies to /api/* (unrelated to passfort) —
      // a normal browser UA passes it, so `undefined` here specifically proves
      // passfort did not intercept the request.
      assert.equal(res, undefined, `${path} must stay reachable without a password`);
    });
  }

  it('/api/rss-proxy passes through even with block-only mode configured for page routes', async () => {
    setPassfortEnv({ PASSFORT_ENABLED: 'true' });
    const res = await middleware(new Request('https://www.worldmonitor.app/api/rss-proxy?url=https%3A%2F%2Fexample.com%2Ffeed.xml', {
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126.0.0.0 Safari/537.36' },
    }));
    assert.equal(res, undefined);
  });
});

describe('passfort password gate — PASSFORT_ENABLED=false disables it without code changes', () => {
  it('does not gate the homepage when explicitly disabled', async () => {
    setPassfortEnv({ PASSFORT_ENABLED: 'false' });
    const res = await middleware(new Request('https://www.worldmonitor.app/'));
    assert.equal(res, undefined);
  });
});
