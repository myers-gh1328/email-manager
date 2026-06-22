import { describe, expect, test, vi, beforeEach } from 'vitest';

const externalSignOnMocks = vi.hoisted(() => ({
  assertExternalSignOnIdentityMatches: vi.fn(),
  consumeExternalSignOnRequest: vi.fn(),
  createExternalSignOnAuthorizationUrl: vi.fn(),
  exchangeExternalSignOnCode: vi.fn(),
  isExternalSignOnProvider: vi.fn((provider: string) => provider === 'google' || provider === 'entra'),
  linkExternalSignOnIdentity: vi.fn(),
  pkceChallenge: vi.fn((verifier: string) => `challenge-for-${verifier}`),
  randomUrlToken: vi.fn(),
  storeExternalSignOnRequest: vi.fn()
}));

const authMocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  isAuthenticated: vi.fn()
}));

vi.mock('$lib/server/external-sign-on', () => externalSignOnMocks);
vi.mock('$lib/server/auth', () => authMocks);

function event({
  provider = 'google',
  url = 'https://app.example.com/auth/external/google/start'
}: {
  provider?: string;
  url?: string;
} = {}) {
  return {
    cookies: { marker: 'cookies' },
    params: { provider },
    url: new URL(url)
  };
}

async function expectRedirect(
  action: Promise<unknown> | unknown,
  status: number,
  location: string
) {
  await expect(Promise.resolve(action)).rejects.toMatchObject({ status, location });
}

describe('external sign-on routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    externalSignOnMocks.isExternalSignOnProvider.mockImplementation(
      (provider: string) => provider === 'google' || provider === 'entra'
    );
    externalSignOnMocks.pkceChallenge.mockImplementation(
      (verifier: string) => `challenge-for-${verifier}`
    );
    externalSignOnMocks.randomUrlToken
      .mockReturnValueOnce('state-token')
      .mockReturnValueOnce('nonce-token')
      .mockReturnValueOnce('verifier-token');
    externalSignOnMocks.createExternalSignOnAuthorizationUrl.mockReturnValue(
      new URL('https://provider.example.com/authorize?state=state-token')
    );
    externalSignOnMocks.consumeExternalSignOnRequest.mockReturnValue({
      provider: 'google',
      mode: 'login',
      state: 'state-token',
      nonce: 'nonce-token',
      codeVerifier: 'verifier-token'
    });
    externalSignOnMocks.exchangeExternalSignOnCode.mockResolvedValue({
      sub: 'provider-subject',
      email: 'owner@example.com',
      name: 'Owner Example'
    });
    authMocks.isAuthenticated.mockReturnValue(false);
  });

  test('unknown provider start redirects to login external error', async () => {
    const { GET } = await import('../src/routes/auth/external/[provider]/start/+server');

    await expectRedirect(GET(event({ provider: 'unknown' }) as never), 303, '/login?error=external');
    expect(externalSignOnMocks.storeExternalSignOnRequest).not.toHaveBeenCalled();
  });

  test.each([
    ['login', 'https://app.example.com/auth/external/google/start']
  ])('start mode %s stores a transient request and redirects to provider URL', async (mode, url) => {
    const { GET } = await import('../src/routes/auth/external/[provider]/start/+server');
    const routeEvent = event({ url });

    await expectRedirect(GET(routeEvent as never), 303, 'https://provider.example.com/authorize?state=state-token');

    expect(externalSignOnMocks.randomUrlToken).toHaveBeenCalledTimes(3);
    expect(externalSignOnMocks.pkceChallenge).toHaveBeenCalledWith('verifier-token');
    expect(externalSignOnMocks.storeExternalSignOnRequest).toHaveBeenCalledWith(routeEvent.cookies, {
      provider: 'google',
      mode,
      state: 'state-token',
      nonce: 'nonce-token',
      codeVerifier: 'verifier-token'
    });
    expect(externalSignOnMocks.createExternalSignOnAuthorizationUrl).toHaveBeenCalledWith({
      origin: 'https://app.example.com',
      provider: 'google',
      mode,
      state: 'state-token',
      nonce: 'nonce-token',
      codeChallenge: 'challenge-for-verifier-token'
    });
  });

  test('start does not store transient request cookies when provider URL creation fails', async () => {
    externalSignOnMocks.createExternalSignOnAuthorizationUrl.mockImplementation(() => {
      throw new Error('Provider settings are incomplete.');
    });
    const { GET } = await import('../src/routes/auth/external/[provider]/start/+server');

    await expectRedirect(
      GET(event({ url: 'https://app.example.com/auth/external/google/start' }) as never),
      303,
      '/login?error=external'
    );

    expect(externalSignOnMocks.storeExternalSignOnRequest).not.toHaveBeenCalled();
  });

  test('unauthenticated link start redirects to login external error', async () => {
    const { GET } = await import('../src/routes/auth/external/[provider]/start/+server');

    await expectRedirect(
      GET(event({ url: 'https://app.example.com/auth/external/google/start?mode=link' }) as never),
      303,
      '/login?error=external'
    );

    expect(externalSignOnMocks.storeExternalSignOnRequest).not.toHaveBeenCalled();
    expect(externalSignOnMocks.createExternalSignOnAuthorizationUrl).not.toHaveBeenCalled();
  });

  test('authenticated link start stores a transient request and redirects to provider URL', async () => {
    authMocks.isAuthenticated.mockReturnValue(true);
    const { GET } = await import('../src/routes/auth/external/[provider]/start/+server');
    const routeEvent = event({
      url: 'https://app.example.com/auth/external/google/start?mode=link'
    });

    await expectRedirect(
      GET(routeEvent as never),
      303,
      'https://provider.example.com/authorize?state=state-token'
    );

    expect(externalSignOnMocks.storeExternalSignOnRequest).toHaveBeenCalledWith(routeEvent.cookies, {
      provider: 'google',
      mode: 'link',
      state: 'state-token',
      nonce: 'nonce-token',
      codeVerifier: 'verifier-token'
    });
  });

  test('callback mismatched state redirects to login external error', async () => {
    const { GET } = await import('../src/routes/auth/external/[provider]/callback/+server');

    await expectRedirect(
      GET(event({ url: 'https://app.example.com/auth/external/google/callback?code=code&state=wrong-state' }) as never),
      303,
      '/login?error=external'
    );
    expect(externalSignOnMocks.exchangeExternalSignOnCode).not.toHaveBeenCalled();
  });

  test('callback missing code redirects to login external error', async () => {
    const { GET } = await import('../src/routes/auth/external/[provider]/callback/+server');

    await expectRedirect(
      GET(event({ url: 'https://app.example.com/auth/external/google/callback?state=state-token' }) as never),
      303,
      '/login?error=external'
    );
    expect(externalSignOnMocks.exchangeExternalSignOnCode).not.toHaveBeenCalled();
  });

  test('login callback with matching identity creates a session and redirects home', async () => {
    const { GET } = await import('../src/routes/auth/external/[provider]/callback/+server');
    const routeEvent = event({
      url: 'https://app.example.com/auth/external/google/callback?code=returned-code&state=state-token'
    });

    await expectRedirect(GET(routeEvent as never), 303, '/');

    expect(externalSignOnMocks.exchangeExternalSignOnCode).toHaveBeenCalledWith({
      origin: 'https://app.example.com',
      provider: 'google',
      code: 'returned-code',
      state: 'state-token',
      codeVerifier: 'verifier-token',
      nonce: 'nonce-token'
    });
    expect(externalSignOnMocks.assertExternalSignOnIdentityMatches).toHaveBeenCalledWith('google', {
      sub: 'provider-subject',
      email: 'owner@example.com',
      name: 'Owner Example'
    });
    expect(authMocks.createSession).toHaveBeenCalledWith(routeEvent.cookies);
  });

  test('unauthenticated link callback redirects to login external error without linking identity', async () => {
    externalSignOnMocks.consumeExternalSignOnRequest.mockReturnValue({
      provider: 'google',
      mode: 'link',
      state: 'state-token',
      nonce: 'nonce-token',
      codeVerifier: 'verifier-token'
    });
    const { GET } = await import('../src/routes/auth/external/[provider]/callback/+server');

    await expectRedirect(
      GET(
        event({
          url: 'https://app.example.com/auth/external/google/callback?code=returned-code&state=state-token'
        }) as never
      ),
      303,
      '/login?error=external'
    );

    expect(externalSignOnMocks.linkExternalSignOnIdentity).not.toHaveBeenCalled();
    expect(authMocks.createSession).not.toHaveBeenCalled();
  });

  test('authenticated link callback stores linked identity and redirects to security settings', async () => {
    authMocks.isAuthenticated.mockReturnValue(true);
    externalSignOnMocks.consumeExternalSignOnRequest.mockReturnValue({
      provider: 'google',
      mode: 'link',
      state: 'state-token',
      nonce: 'nonce-token',
      codeVerifier: 'verifier-token'
    });
    const { GET } = await import('../src/routes/auth/external/[provider]/callback/+server');

    await expectRedirect(
      GET(
        event({
          url: 'https://app.example.com/auth/external/google/callback?code=returned-code&state=state-token'
        }) as never
      ),
      303,
      '/settings?section=security&externalSignOn=linked'
    );

    expect(externalSignOnMocks.linkExternalSignOnIdentity).toHaveBeenCalledWith('google', {
      sub: 'provider-subject',
      email: 'owner@example.com',
      name: 'Owner Example'
    });
    expect(authMocks.createSession).not.toHaveBeenCalled();
  });

  test('callback passes returned state into code exchange', async () => {
    const { GET } = await import('../src/routes/auth/external/[provider]/callback/+server');

    await expectRedirect(
      GET(
        event({
          url: 'https://app.example.com/auth/external/google/callback?code=returned-code&state=state-token'
        }) as never
      ),
      303,
      '/'
    );

    expect(externalSignOnMocks.exchangeExternalSignOnCode).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'state-token' })
    );
  });
});
