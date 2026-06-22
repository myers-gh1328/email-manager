import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createTestRepository } from './repository-helpers';

function fakeCookies() {
  const values = new Map<string, string>();
  return {
    get: vi.fn((name: string) => values.get(name)),
    set: vi.fn((name: string, value: string) => values.set(name, value)),
    delete: vi.fn((name: string) => values.delete(name))
  };
}

describe('auth sessions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  test('logout deletes the stored server-side session', async () => {
    const repo = createTestRepository();
    vi.doMock('../src/lib/server/app', () => ({ repo }));
    const cookies = fakeCookies();
    const { clearSession, createSession, isAuthenticated } = await import('../src/lib/server/auth');
    createSession(cookies as never);
    expect(isAuthenticated(cookies as never)).toBe(true);

    clearSession(cookies as never);

    expect(isAuthenticated(cookies as never)).toBe(false);
  });

  test('password changes revoke existing sessions', async () => {
    const repo = createTestRepository();
    vi.doMock('../src/lib/server/app', () => ({ repo }));
    const cookies = fakeCookies();
    const { createSession, isAuthenticated, setAdminPassword } = await import('../src/lib/server/auth');
    createSession(cookies as never);
    expect(isAuthenticated(cookies as never)).toBe(true);

    setAdminPassword('new long password');

    expect(isAuthenticated(cookies as never)).toBe(false);
  });

  test('expired stored sessions are rejected', async () => {
    const repo = createTestRepository();
    vi.doMock('../src/lib/server/app', () => ({ repo }));
    const cookies = fakeCookies();
    const { createSession, isAuthenticated, sessionSettingKey } = await import('../src/lib/server/auth');
    createSession(cookies as never);
    const token = cookies.get('scuba_email_session') ?? '';
    repo.setSetting(sessionSettingKey(token), new Date('2000-01-01T00:00:00.000Z').toISOString());

    expect(isAuthenticated(cookies as never)).toBe(false);
  });

  test('failed login attempts are throttled per client key', async () => {
    const repo = createTestRepository();
    vi.doMock('../src/lib/server/app', () => ({ repo }));
    const { clearLoginFailures, loginThrottleStatus, recordLoginFailure } = await import('../src/lib/server/auth');

    clearLoginFailures('client-1');
    recordLoginFailure('client-1');
    recordLoginFailure('client-1');
    expect(loginThrottleStatus('client-1').limited).toBe(false);

    recordLoginFailure('client-1');

    expect(loginThrottleStatus('client-1').limited).toBe(true);
  });
});
