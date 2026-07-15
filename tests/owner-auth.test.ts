import { describe, expect, test, vi } from 'vitest';
import { applyOwnerAuth, createDeploymentOwnerAuth } from '../src/lib/server/owner-auth';

const completeEnv = {
  SCUBA_EMAIL_OWNER_AUTH_ENABLED: 'true',
  SCUBA_EMAIL_ENTRA_TENANT_ID: '132f165d-850f-4c63-a2c8-3748a1bbdc44',
  SCUBA_EMAIL_ENTRA_CLIENT_ID: '93c6c50b-93a0-4d2c-bab4-eb8aa1b21e83',
  SCUBA_EMAIL_ENTRA_CLIENT_SECRET: 'client-secret',
  SCUBA_EMAIL_ENTRA_REDIRECT_URIS: 'https://contact.example.com/auth/callback',
  SCUBA_EMAIL_ENTRA_POST_LOGOUT_REDIRECT_URI: 'https://contact.example.com/login',
  SCUBA_EMAIL_ENTRA_ALLOWED_OBJECT_IDS: '11111111-1111-1111-1111-111111111111',
  SCUBA_EMAIL_OWNER_SESSION_SECRET: 'a-secure-cookie-key-with-more-than-32-bytes'
};

describe('deployment owner authentication', () => {
  test('stays disabled unless explicitly enabled', () => {
    const factory = vi.fn();
    expect(createDeploymentOwnerAuth({}, factory)).toBeUndefined();
    expect(factory).not.toHaveBeenCalled();
  });

  test('configures the shared owner-oidc package with an exact owner allowlist', () => {
    const auth = { handle: vi.fn(), protect: vi.fn(), session: vi.fn() };
    const factory = vi.fn(() => auth);

    expect(createDeploymentOwnerAuth(completeEnv, factory)).toBe(auth);
    expect(factory).toHaveBeenCalledWith({
      tenantId: completeEnv.SCUBA_EMAIL_ENTRA_TENANT_ID,
      clientId: completeEnv.SCUBA_EMAIL_ENTRA_CLIENT_ID,
      clientSecret: completeEnv.SCUBA_EMAIL_ENTRA_CLIENT_SECRET,
      redirectUris: [completeEnv.SCUBA_EMAIL_ENTRA_REDIRECT_URIS],
      postLogoutRedirectUri: completeEnv.SCUBA_EMAIL_ENTRA_POST_LOGOUT_REDIRECT_URI,
      allowedObjectIds: [completeEnv.SCUBA_EMAIL_ENTRA_ALLOWED_OBJECT_IDS],
      cookieSecret: completeEnv.SCUBA_EMAIL_OWNER_SESSION_SECRET,
      cookiePrefix: 'email_manager',
      publicPaths: ['/healthz']
    });
  });

  test.each([
    'SCUBA_EMAIL_ENTRA_TENANT_ID',
    'SCUBA_EMAIL_ENTRA_CLIENT_ID',
    'SCUBA_EMAIL_ENTRA_CLIENT_SECRET',
    'SCUBA_EMAIL_ENTRA_REDIRECT_URIS',
    'SCUBA_EMAIL_ENTRA_POST_LOGOUT_REDIRECT_URI',
    'SCUBA_EMAIL_ENTRA_ALLOWED_OBJECT_IDS',
    'SCUBA_EMAIL_OWNER_SESSION_SECRET'
  ])('fails closed when %s is missing', (name) => {
    expect(() => createDeploymentOwnerAuth({ ...completeEnv, [name]: '' })).toThrow(name);
  });

  test.each([
    ['SCUBA_EMAIL_ENTRA_TENANT_ID', 'common'],
    ['SCUBA_EMAIL_ENTRA_CLIENT_ID', 'not-a-guid'],
    ['SCUBA_EMAIL_ENTRA_ALLOWED_OBJECT_IDS', '*'],
    ['SCUBA_EMAIL_ENTRA_ALLOWED_OBJECT_IDS', '00000000-0000-0000-0000-000000000000'],
    ['SCUBA_EMAIL_ENTRA_REDIRECT_URIS', 'https://contact.example.com/auth/callback,https://other.example.com/auth/callback'],
    ['SCUBA_EMAIL_ENTRA_REDIRECT_URIS', 'http://contact.example.com/auth/callback'],
    ['SCUBA_EMAIL_ENTRA_REDIRECT_URIS', 'https://contact.example.com/wrong'],
    ['SCUBA_EMAIL_ENTRA_POST_LOGOUT_REDIRECT_URI', 'http://contact.example.com/login']
  ])('rejects unsafe %s configuration', (name, value) => {
    expect(() => createDeploymentOwnerAuth({ ...completeEnv, [name]: value })).toThrow(name);
  });
});

describe('owner authentication request handling', () => {
  test('returns package auth route responses before application routing', async () => {
    const response = new Response(null, { status: 302 });
    const auth = {
      handle: vi.fn(async () => response),
      protect: vi.fn(),
      session: vi.fn()
    };

    expect(await applyOwnerAuth(auth, new Request('https://contact.example.com/auth/login'))).toEqual({
      authenticated: false,
      response
    });
    expect(auth.protect).not.toHaveBeenCalled();
  });

  test('protects application routes and exposes an authenticated owner session', async () => {
    const request = new Request('https://contact.example.com/settings');
    const auth = {
      handle: vi.fn(async () => undefined),
      protect: vi.fn(() => undefined),
      session: vi.fn(() => ({ authenticated: true, user: { oid: 'owner' } }))
    };

    expect(await applyOwnerAuth(auth, request)).toEqual({ authenticated: true });
    expect(auth.protect).toHaveBeenCalledWith(request);
  });

  test('routes the existing logout URL through owner-oidc logout', async () => {
    const auth = {
      handle: vi.fn(async () => undefined),
      protect: vi.fn(),
      session: vi.fn()
    };

    const result = await applyOwnerAuth(auth, new Request('https://contact.example.com/logout'));
    expect(result.response?.status).toBe(303);
    expect(result.response?.headers.get('location')).toBe('/auth/logout');
  });
});
