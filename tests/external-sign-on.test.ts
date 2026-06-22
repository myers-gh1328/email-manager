import { beforeEach, describe, expect, test, vi } from 'vitest';
import { encryptSecret } from '../src/lib/server/crypto';

const settings = new Map<string, string>();
const oidcMocks = vi.hoisted(() => ({
  discovery: vi.fn(),
  authorizationCodeGrant: vi.fn(),
  ClientSecretPost: vi.fn((clientSecret: string) => ({ clientSecretAuth: clientSecret }))
}));

vi.mock('../src/lib/server/app', () => ({
  repo: {
    getSetting: (key: string) => settings.get(key) ?? '',
    setSetting: (key: string, value: string) => settings.set(key, value),
    deleteSetting: (key: string) => settings.delete(key),
    __clear: () => settings.clear()
  }
}));

vi.mock('openid-client', () => oidcMocks);

function fakeCookies() {
  const values = new Map<string, string>();
  const setOptions = new Map<string, unknown>();
  const deleteOptions = new Map<string, unknown>();
  return {
    get: vi.fn((name: string) => values.get(name)),
    set: vi.fn((name: string, value: string, options: unknown) => {
      values.set(name, value);
      setOptions.set(name, options);
    }),
    delete: vi.fn((name: string, options: unknown) => {
      values.delete(name);
      deleteOptions.set(name, options);
    }),
    setOptions,
    deleteOptions
  };
}

describe('external sign-on status', () => {
  beforeEach(async () => {
    vi.useRealTimers();
    settings.clear();
    oidcMocks.discovery.mockReset();
    oidcMocks.authorizationCodeGrant.mockReset();
    oidcMocks.ClientSecretPost.mockClear();
    const { setExternalSignOnOidcAdapterForTests } = await import(
      '../src/lib/server/external-sign-on'
    );
    setExternalSignOnOidcAdapterForTests(undefined);
  });

  test('returns disabled status by default', async () => {
    const { getExternalSignOnStatus } = await import('../src/lib/server/external-sign-on');

    expect(getExternalSignOnStatus()).toEqual({
      enabled: false,
      provider: '',
      providerLabel: '',
      email: '',
      name: '',
      linkedAt: '',
      googleClientId: '',
      googleClientSecretConfigured: false,
      entraTenant: 'common',
      entraClientId: '',
      entraClientSecretConfigured: false
    });
  });

  test('reports seeded Google identity without exposing plaintext secrets', async () => {
    settings.set('auth.sso.provider', 'google');
    settings.set('auth.sso.subject', 'google-subject-1');
    settings.set('auth.sso.email', 'learner@example.com');
    settings.set('auth.sso.name', 'Learner Example');
    settings.set('auth.sso.linkedAt', '2026-06-22T12:00:00.000Z');
    settings.set('auth.sso.google.clientId', 'google-client-id');
    settings.set('auth.sso.google.clientSecret', encryptSecret('plain-google-secret'));
    const { getExternalSignOnStatus } = await import('../src/lib/server/external-sign-on');

    const status = getExternalSignOnStatus();

    expect(status).toMatchObject({
      enabled: true,
      provider: 'google',
      providerLabel: 'Google',
      email: 'learner@example.com',
      name: 'Learner Example',
      googleClientSecretConfigured: true
    });
    expect(JSON.stringify(status)).not.toContain('plain-google-secret');
  });

  test('links a Google identity and reports enabled status', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T13:14:15.000Z'));
    const { getExternalSignOnStatus, linkExternalSignOnIdentity } = await import(
      '../src/lib/server/external-sign-on'
    );

    linkExternalSignOnIdentity('google', {
      sub: 'google-sub',
      email: 'owner@example.com',
      name: 'Owner Example'
    });

    expect(getExternalSignOnStatus()).toMatchObject({
      enabled: true,
      provider: 'google',
      providerLabel: 'Google',
      email: 'owner@example.com',
      name: 'Owner Example',
      linkedAt: '2026-06-22T13:14:15.000Z'
    });
  });

  test('accepts exact linked identity and rejects mismatched provider or subject', async () => {
    const { assertExternalSignOnIdentityMatches, linkExternalSignOnIdentity } = await import(
      '../src/lib/server/external-sign-on'
    );

    linkExternalSignOnIdentity('google', { sub: 'google-sub' });

    expect(() =>
      assertExternalSignOnIdentityMatches('google', { sub: 'google-sub' })
    ).not.toThrow();
    expect(() => assertExternalSignOnIdentityMatches('entra', { sub: 'google-sub' })).toThrow(
      new Error('That account is not linked to this app.')
    );
    expect(() => assertExternalSignOnIdentityMatches('google', { sub: 'other-sub' })).toThrow(
      new Error('That account is not linked to this app.')
    );
  });

  test('stores and matches opaque provider subjects exactly', async () => {
    const { assertExternalSignOnIdentityMatches, linkExternalSignOnIdentity } = await import(
      '../src/lib/server/external-sign-on'
    );

    linkExternalSignOnIdentity('google', { sub: ' google-sub ' });

    expect(settings.get('auth.sso.subject')).toBe(' google-sub ');
    expect(() =>
      assertExternalSignOnIdentityMatches('google', { sub: ' google-sub ' })
    ).not.toThrow();
    expect(() => assertExternalSignOnIdentityMatches('google', { sub: 'google-sub' })).toThrow(
      new Error('That account is not linked to this app.')
    );
  });

  test('rejects matching an identity when claims are malformed', async () => {
    const { assertExternalSignOnIdentityMatches, linkExternalSignOnIdentity } = await import(
      '../src/lib/server/external-sign-on'
    );

    linkExternalSignOnIdentity('google', { sub: 'google-sub' });

    expect(() => assertExternalSignOnIdentityMatches('google', {} as never)).toThrow(
      new Error('That account is not linked to this app.')
    );
  });

  test('clears linked identity while preserving provider configuration', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T13:14:15.000Z'));
    const {
      clearExternalSignOnIdentity,
      getExternalSignOnClientSecret,
      getExternalSignOnStatus,
      linkExternalSignOnIdentity,
      updateExternalSignOnProviderSettings
    } = await import('../src/lib/server/external-sign-on');

    updateExternalSignOnProviderSettings({
      provider: 'google',
      googleClientId: 'google-client',
      googleClientSecret: 'google-secret',
      entraTenant: '',
      entraClientId: '',
      entraClientSecret: ''
    });
    linkExternalSignOnIdentity('google', {
      sub: 'google-sub',
      email: 'owner@example.com',
      name: 'Owner Example'
    });

    clearExternalSignOnIdentity();

    expect(getExternalSignOnStatus()).toMatchObject({
      enabled: false,
      provider: 'google',
      providerLabel: 'Google',
      email: '',
      name: '',
      linkedAt: '',
      googleClientId: 'google-client',
      googleClientSecretConfigured: true
    });
    expect(getExternalSignOnClientSecret('google')).toBe('google-secret');
  });

  test('rejects linking an identity when the subject is missing', async () => {
    const { linkExternalSignOnIdentity } = await import('../src/lib/server/external-sign-on');

    expect(() => linkExternalSignOnIdentity('google', {} as never)).toThrow(
      new Error('The provider did not return an account identifier.')
    );
    expect(() => linkExternalSignOnIdentity('google', { sub: '' })).toThrow(
      new Error('The provider did not return an account identifier.')
    );
    expect(() => linkExternalSignOnIdentity('google', { sub: '   ' })).toThrow(
      new Error('The provider did not return an account identifier.')
    );
  });

  test('saves Google provider settings and preserves blank secret updates', async () => {
    const {
      getExternalSignOnClientSecret,
      getExternalSignOnStatus,
      updateExternalSignOnProviderSettings
    } = await import('../src/lib/server/external-sign-on');

    updateExternalSignOnProviderSettings({
      provider: 'google',
      googleClientId: 'first-google-client',
      googleClientSecret: 'first-google-secret',
      entraTenant: '',
      entraClientId: '',
      entraClientSecret: ''
    });
    updateExternalSignOnProviderSettings({
      provider: 'google',
      googleClientId: 'second-google-client',
      googleClientSecret: '',
      entraTenant: '',
      entraClientId: '',
      entraClientSecret: ''
    });

    expect(getExternalSignOnStatus()).toMatchObject({
      provider: 'google',
      googleClientId: 'second-google-client',
      googleClientSecretConfigured: true
    });
    expect(getExternalSignOnClientSecret('google')).toBe('first-google-secret');
  });

  test('saves Entra provider settings and normalizes blank tenant to common', async () => {
    const {
      getExternalSignOnClientSecret,
      getExternalSignOnStatus,
      updateExternalSignOnProviderSettings
    } = await import('../src/lib/server/external-sign-on');

    updateExternalSignOnProviderSettings({
      provider: 'entra',
      googleClientId: '',
      googleClientSecret: '',
      entraTenant: '',
      entraClientId: 'entra-client',
      entraClientSecret: 'entra-secret'
    });

    expect(getExternalSignOnStatus()).toMatchObject({
      provider: 'entra',
      entraTenant: 'common',
      entraClientId: 'entra-client',
      entraClientSecretConfigured: true
    });
    expect(getExternalSignOnClientSecret('entra')).toBe('entra-secret');
  });

  test('uses configured public base URL for Google redirect URI', async () => {
    settings.set('server.publicBaseUrl', 'https://app.example.com/');
    const { externalSignOnRedirectUri } = await import('../src/lib/server/external-sign-on');

    expect(externalSignOnRedirectUri('https://localhost:5173', 'google')).toBe(
      'https://app.example.com/auth/external/google/callback'
    );
  });

  test('uses request origin for Entra redirect URI without public base URL', async () => {
    const { externalSignOnRedirectUri } = await import('../src/lib/server/external-sign-on');

    expect(externalSignOnRedirectUri('http://127.0.0.1:5173', 'entra')).toBe(
      'http://127.0.0.1:5173/auth/external/entra/callback'
    );
  });

  test('creates Google authorization URL from saved provider settings', async () => {
    const { createExternalSignOnAuthorizationUrl, updateExternalSignOnProviderSettings } =
      await import('../src/lib/server/external-sign-on');

    updateExternalSignOnProviderSettings({
      provider: 'google',
      googleClientId: 'google-client',
      googleClientSecret: 'google-secret',
      entraTenant: '',
      entraClientId: '',
      entraClientSecret: ''
    });

    const url = createExternalSignOnAuthorizationUrl({
      origin: 'https://localhost:5173',
      provider: 'google',
      mode: 'login',
      state: 'state-token',
      nonce: 'nonce-token',
      codeChallenge: 'challenge-token'
    });

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.pathname).toBe('/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('google-client');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://localhost:5173/auth/external/google/callback'
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-token');
    expect(url.searchParams.get('nonce')).toBe('nonce-token');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-token');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.has('access_type')).toBe(false);
    expect(url.searchParams.has('client_secret')).toBe(false);
    expect(url.toString()).not.toContain('google-secret');
  });

  test('creates Entra authorization URL from saved provider settings', async () => {
    const { createExternalSignOnAuthorizationUrl, updateExternalSignOnProviderSettings } =
      await import('../src/lib/server/external-sign-on');

    updateExternalSignOnProviderSettings({
      provider: 'entra',
      googleClientId: '',
      googleClientSecret: '',
      entraTenant: 'contoso.onmicrosoft.com',
      entraClientId: 'entra-client',
      entraClientSecret: 'entra-secret'
    });

    const url = createExternalSignOnAuthorizationUrl({
      origin: 'https://localhost:5173',
      provider: 'entra',
      mode: 'link',
      state: 'state-token',
      nonce: 'nonce-token',
      codeChallenge: 'challenge-token'
    });

    expect(url.host).toBe('login.microsoftonline.com');
    expect(url.pathname).toBe('/contoso.onmicrosoft.com/oauth2/v2.0/authorize');
    expect(url.searchParams.get('client_id')).toBe('entra-client');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://localhost:5173/auth/external/entra/callback'
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-token');
    expect(url.searchParams.get('nonce')).toBe('nonce-token');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-token');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.has('client_secret')).toBe(false);
    expect(url.toString()).not.toContain('entra-secret');
  });

  test('uses mode-specific missing configuration errors', async () => {
    const { createExternalSignOnAuthorizationUrl } = await import(
      '../src/lib/server/external-sign-on'
    );

    expect(() =>
      createExternalSignOnAuthorizationUrl({
        origin: 'https://localhost:5173',
        provider: 'google',
        mode: 'link',
        state: 'state-token',
        nonce: 'nonce-token',
        codeChallenge: 'challenge-token'
      })
    ).toThrow('Configure the Google client ID before connecting sign-on.');

    settings.set('auth.sso.entra.clientId', 'entra-client');

    expect(() =>
      createExternalSignOnAuthorizationUrl({
        origin: 'https://localhost:5173',
        provider: 'entra',
        mode: 'login',
        state: 'state-token',
        nonce: 'nonce-token',
        codeChallenge: 'challenge-token'
      })
    ).toThrow('Configure the Microsoft Entra ID client secret before signing in.');
  });

  test('exchanges a Google callback through the configured OIDC adapter', async () => {
    const {
      exchangeExternalSignOnCode,
      setExternalSignOnOidcAdapterForTests,
      updateExternalSignOnProviderSettings
    } = await import('../src/lib/server/external-sign-on');
    const exchange = vi.fn().mockResolvedValue({
      sub: 'google-subject',
      email: 'owner@example.com',
      name: 'Owner Example'
    });

    try {
      updateExternalSignOnProviderSettings({
        provider: 'google',
        googleClientId: 'google-client',
        googleClientSecret: 'google-secret',
        entraTenant: '',
        entraClientId: '',
        entraClientSecret: ''
      });
      setExternalSignOnOidcAdapterForTests({ exchange });

      await expect(
        exchangeExternalSignOnCode({
          origin: 'https://app.example.com',
          provider: 'google',
          code: 'code',
          state: 'state',
          codeVerifier: 'verifier',
          nonce: 'nonce'
        })
      ).resolves.toEqual({
        sub: 'google-subject',
        email: 'owner@example.com',
        name: 'Owner Example'
      });

      expect(exchange).toHaveBeenCalledWith({
        origin: 'https://app.example.com',
        provider: 'google',
        code: 'code',
        state: 'state',
        codeVerifier: 'verifier',
        nonce: 'nonce',
        clientId: 'google-client',
        clientSecret: 'google-secret',
        redirectUri: 'https://app.example.com/auth/external/google/callback'
      });
    } finally {
      setExternalSignOnOidcAdapterForTests(undefined);
    }
  });

  test('rejects callback claims without a provider subject', async () => {
    const {
      exchangeExternalSignOnCode,
      setExternalSignOnOidcAdapterForTests,
      updateExternalSignOnProviderSettings
    } = await import('../src/lib/server/external-sign-on');

    try {
      updateExternalSignOnProviderSettings({
        provider: 'google',
        googleClientId: 'google-client',
        googleClientSecret: 'google-secret',
        entraTenant: '',
        entraClientId: '',
        entraClientSecret: ''
      });
      setExternalSignOnOidcAdapterForTests({
        exchange: vi.fn().mockResolvedValue({ sub: '   ' })
      });

      await expect(
        exchangeExternalSignOnCode({
          origin: 'https://app.example.com',
          provider: 'google',
          code: 'code',
          state: 'state',
          codeVerifier: 'verifier',
          nonce: 'nonce'
        })
      ).rejects.toThrow('The provider did not return an account identifier.');
    } finally {
      setExternalSignOnOidcAdapterForTests(undefined);
    }
  });

  test('rejects callback claims when the provider subject is missing', async () => {
    const {
      exchangeExternalSignOnCode,
      setExternalSignOnOidcAdapterForTests,
      updateExternalSignOnProviderSettings
    } = await import('../src/lib/server/external-sign-on');

    try {
      updateExternalSignOnProviderSettings({
        provider: 'google',
        googleClientId: 'google-client',
        googleClientSecret: 'google-secret',
        entraTenant: '',
        entraClientId: '',
        entraClientSecret: ''
      });
      setExternalSignOnOidcAdapterForTests({
        exchange: vi.fn().mockResolvedValue({} as never)
      });

      await expect(
        exchangeExternalSignOnCode({
          origin: 'https://app.example.com',
          provider: 'google',
          code: 'code',
          state: 'state',
          codeVerifier: 'verifier',
          nonce: 'nonce'
        })
      ).rejects.toThrow('The provider did not return an account identifier.');
    } finally {
      setExternalSignOnOidcAdapterForTests(undefined);
    }
  });

  test('clearing the OIDC adapter prevents later exchange calls from using it', async () => {
    const {
      exchangeExternalSignOnCode,
      setExternalSignOnOidcAdapterForTests,
      updateExternalSignOnProviderSettings
    } = await import('../src/lib/server/external-sign-on');
    const exchange = vi.fn().mockResolvedValue({ sub: 'stale-adapter-subject' });

    try {
      oidcMocks.discovery.mockRejectedValue(new Error('default adapter used'));
      updateExternalSignOnProviderSettings({
        provider: 'google',
        googleClientId: 'google-client',
        googleClientSecret: 'google-secret',
        entraTenant: '',
        entraClientId: '',
        entraClientSecret: ''
      });

      setExternalSignOnOidcAdapterForTests({ exchange });
      setExternalSignOnOidcAdapterForTests(undefined);

      await expect(
        exchangeExternalSignOnCode({
          origin: 'https://app.example.com',
          provider: 'google',
          code: 'code',
          state: 'state',
          codeVerifier: 'verifier',
          nonce: 'nonce'
        })
      ).rejects.toThrow();
      expect(exchange).not.toHaveBeenCalled();
      expect(oidcMocks.discovery).toHaveBeenCalled();
    } finally {
      setExternalSignOnOidcAdapterForTests(undefined);
    }
  });

  test('uses openid-client to exchange Google callbacks with state and nonce checks', async () => {
    const config = { providerConfig: 'google' };
    oidcMocks.discovery.mockResolvedValue(config);
    oidcMocks.authorizationCodeGrant.mockResolvedValue({
      claims: () => ({
        sub: 'provider-sub',
        email: 'owner@example.com',
        name: 'Owner Example',
        picture: 'ignored'
      })
    });
    const { exchangeExternalSignOnCode, updateExternalSignOnProviderSettings } = await import(
      '../src/lib/server/external-sign-on'
    );

    updateExternalSignOnProviderSettings({
      provider: 'google',
      googleClientId: 'google-client',
      googleClientSecret: 'google-secret',
      entraTenant: '',
      entraClientId: '',
      entraClientSecret: ''
    });

    await expect(
      exchangeExternalSignOnCode({
        origin: 'https://app.example.com',
        provider: 'google',
        code: 'code',
        state: 'state',
        codeVerifier: 'verifier',
        nonce: 'nonce'
      })
    ).resolves.toEqual({
      sub: 'provider-sub',
      email: 'owner@example.com',
      name: 'Owner Example'
    });

    expect(oidcMocks.ClientSecretPost).toHaveBeenCalledWith('google-secret');
    const [issuerUrl, clientId, metadata, clientAuth] = oidcMocks.discovery.mock.calls[0];
    expect(issuerUrl.href).toBe('https://accounts.google.com/');
    expect(clientId).toBe('google-client');
    expect(metadata).toEqual({
      client_secret: 'google-secret',
      redirect_uris: ['https://app.example.com/auth/external/google/callback'],
      response_types: ['code']
    });
    expect(clientAuth).toBe(oidcMocks.ClientSecretPost.mock.results[0].value);

    const [grantConfig, callbackUrl, checks] = oidcMocks.authorizationCodeGrant.mock.calls[0];
    expect(grantConfig).toBe(config);
    expect(callbackUrl.href).toBe(
      'https://app.example.com/auth/external/google/callback?code=code&state=state'
    );
    expect(checks).toEqual({
      expectedState: 'state',
      expectedNonce: 'nonce',
      pkceCodeVerifier: 'verifier'
    });
  });

  test('uses the configured Entra tenant issuer for default OIDC exchange', async () => {
    const config = { providerConfig: 'entra' };
    oidcMocks.discovery.mockResolvedValue(config);
    oidcMocks.authorizationCodeGrant.mockResolvedValue({
      claims: () => ({ sub: 'entra-subject' })
    });
    const { exchangeExternalSignOnCode, updateExternalSignOnProviderSettings } = await import(
      '../src/lib/server/external-sign-on'
    );

    updateExternalSignOnProviderSettings({
      provider: 'entra',
      googleClientId: '',
      googleClientSecret: '',
      entraTenant: 'contoso.onmicrosoft.com',
      entraClientId: 'entra-client',
      entraClientSecret: 'entra-secret'
    });

    await expect(
      exchangeExternalSignOnCode({
        origin: 'https://app.example.com',
        provider: 'entra',
        code: 'code',
        state: 'state',
        codeVerifier: 'verifier',
        nonce: 'nonce'
      })
    ).resolves.toEqual({ sub: 'entra-subject', email: undefined, name: undefined });

    expect(oidcMocks.ClientSecretPost).toHaveBeenCalledWith('entra-secret');
    const [issuerUrl, clientId, metadata, clientAuth] = oidcMocks.discovery.mock.calls[0];
    expect(issuerUrl.href).toBe(
      'https://login.microsoftonline.com/contoso.onmicrosoft.com/v2.0'
    );
    expect(clientId).toBe('entra-client');
    expect(metadata).toEqual({
      client_secret: 'entra-secret',
      redirect_uris: ['https://app.example.com/auth/external/entra/callback'],
      response_types: ['code']
    });
    expect(clientAuth).toBe(oidcMocks.ClientSecretPost.mock.results[0].value);

    const [grantConfig, callbackUrl, checks] = oidcMocks.authorizationCodeGrant.mock.calls[0];
    expect(grantConfig).toBe(config);
    expect(callbackUrl.href).toBe(
      'https://app.example.com/auth/external/entra/callback?code=code&state=state'
    );
    expect(checks).toEqual({
      expectedState: 'state',
      expectedNonce: 'nonce',
      pkceCodeVerifier: 'verifier'
    });
  });

  test('rejects incomplete provider credentials before calling the OIDC adapter', async () => {
    const { exchangeExternalSignOnCode, setExternalSignOnOidcAdapterForTests } = await import(
      '../src/lib/server/external-sign-on'
    );
    const exchange = vi.fn();

    try {
      settings.set('auth.sso.google.clientId', 'google-client');
      setExternalSignOnOidcAdapterForTests({ exchange });

      await expect(
        exchangeExternalSignOnCode({
          origin: 'https://app.example.com',
          provider: 'google',
          code: 'code',
          state: 'state',
          codeVerifier: 'verifier',
          nonce: 'nonce'
        })
      ).rejects.toThrow('External sign-on provider settings are incomplete.');
      expect(exchange).not.toHaveBeenCalled();
    } finally {
      setExternalSignOnOidcAdapterForTests(undefined);
    }
  });

  test('stores and consumes an external sign-on request', async () => {
    const { consumeExternalSignOnRequest, storeExternalSignOnRequest } = await import(
      '../src/lib/server/external-sign-on'
    );
    const originalSecureCookies = process.env.SCUBA_EMAIL_SECURE_COOKIES;
    delete process.env.SCUBA_EMAIL_SECURE_COOKIES;
    try {
      const cookies = fakeCookies();
      const request = {
        provider: 'google' as const,
        mode: 'link' as const,
        state: 'state-value',
        nonce: 'nonce-value',
        codeVerifier: 'verifier-value'
      };

      storeExternalSignOnRequest(cookies as never, request);

      for (const name of [
        'tcs_sso_provider',
        'tcs_sso_mode',
        'tcs_sso_state',
        'tcs_sso_nonce',
        'tcs_sso_code_verifier'
      ]) {
        expect(cookies.setOptions.get(name)).toEqual({
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 600,
          secure: false
        });
      }

      expect(consumeExternalSignOnRequest(cookies as never, 'google')).toEqual(request);
      expect(cookies.get('tcs_sso_provider')).toBeUndefined();
      expect(cookies.get('tcs_sso_mode')).toBeUndefined();
      expect(cookies.get('tcs_sso_state')).toBeUndefined();
      expect(cookies.get('tcs_sso_nonce')).toBeUndefined();
      expect(cookies.get('tcs_sso_code_verifier')).toBeUndefined();
      for (const name of [
        'tcs_sso_provider',
        'tcs_sso_mode',
        'tcs_sso_state',
        'tcs_sso_nonce',
        'tcs_sso_code_verifier'
      ]) {
        expect(cookies.deleteOptions.get(name)).toEqual({ path: '/' });
      }
    } finally {
      if (originalSecureCookies === undefined) {
        delete process.env.SCUBA_EMAIL_SECURE_COOKIES;
      } else {
        process.env.SCUBA_EMAIL_SECURE_COOKIES = originalSecureCookies;
      }
    }
  });

  test('stores external sign-on request cookies as secure when configured', async () => {
    const originalSecureCookies = process.env.SCUBA_EMAIL_SECURE_COOKIES;
    process.env.SCUBA_EMAIL_SECURE_COOKIES = 'true';
    try {
      const { storeExternalSignOnRequest } = await import('../src/lib/server/external-sign-on');
      const cookies = fakeCookies();

      storeExternalSignOnRequest(cookies as never, {
        provider: 'google',
        mode: 'link',
        state: 'state-value',
        nonce: 'nonce-value',
        codeVerifier: 'verifier-value'
      });

      for (const name of [
        'tcs_sso_provider',
        'tcs_sso_mode',
        'tcs_sso_state',
        'tcs_sso_nonce',
        'tcs_sso_code_verifier'
      ]) {
        expect(cookies.setOptions.get(name)).toMatchObject({ secure: true });
      }
    } finally {
      if (originalSecureCookies === undefined) {
        delete process.env.SCUBA_EMAIL_SECURE_COOKIES;
      } else {
        process.env.SCUBA_EMAIL_SECURE_COOKIES = originalSecureCookies;
      }
    }
  });

  test('clears external sign-on request cookies when provider does not match', async () => {
    const { consumeExternalSignOnRequest, storeExternalSignOnRequest } = await import(
      '../src/lib/server/external-sign-on'
    );
    const cookies = fakeCookies();

    storeExternalSignOnRequest(cookies as never, {
      provider: 'google',
      mode: 'link',
      state: 'state-value',
      nonce: 'nonce-value',
      codeVerifier: 'verifier-value'
    });

    expect(() => consumeExternalSignOnRequest(cookies as never, 'entra')).toThrow(
      'The sign-on request expired. Start again.'
    );
    expect(cookies.get('tcs_sso_provider')).toBeUndefined();
    expect(cookies.get('tcs_sso_mode')).toBeUndefined();
    expect(cookies.get('tcs_sso_state')).toBeUndefined();
    expect(cookies.get('tcs_sso_nonce')).toBeUndefined();
    expect(cookies.get('tcs_sso_code_verifier')).toBeUndefined();
    for (const name of [
      'tcs_sso_provider',
      'tcs_sso_mode',
      'tcs_sso_state',
      'tcs_sso_nonce',
      'tcs_sso_code_verifier'
    ]) {
      expect(cookies.deleteOptions.get(name)).toEqual({ path: '/' });
    }
  });

  test('creates a SHA-256 base64url PKCE challenge', async () => {
    const { pkceChallenge } = await import('../src/lib/server/external-sign-on');

    expect(pkceChallenge('verifier-value')).toBe(
      'GPXfFfmq30W8w5PWMLNtzZR2q9pxnxZ4FkY2A8xIsF4'
    );
  });
});
