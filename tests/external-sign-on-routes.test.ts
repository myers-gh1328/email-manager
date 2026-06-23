import { describe, expect, test, vi, beforeEach } from 'vitest';

const externalSignOnMocks = vi.hoisted(() => ({
  assertExternalSignOnIdentityMatches: vi.fn(),
  allowExternalSignOnLink: vi.fn(),
  clearExternalSignOnIdentity: vi.fn(),
  consumeExternalSignOnLinkAllowance: vi.fn(),
  consumeExternalSignOnRequest: vi.fn(),
  createExternalSignOnAuthorizationUrl: vi.fn(),
  exchangeExternalSignOnCode: vi.fn(),
  externalSignOnRedirectUri: vi.fn((origin: string, provider: string) => `${origin}/auth/external/${provider}/callback`),
  getExternalSignOnStatus: vi.fn(),
  isExternalSignOnProvider: vi.fn((provider: string) => provider === 'google' || provider === 'entra'),
  linkExternalSignOnIdentity: vi.fn(),
  pkceChallenge: vi.fn((verifier: string) => `challenge-for-${verifier}`),
  randomUrlToken: vi.fn(),
  storeExternalSignOnRequest: vi.fn(),
  updateExternalSignOnProviderSettings: vi.fn()
}));

const authMocks = vi.hoisted(() => ({
  clearLoginFailures: vi.fn(),
  createSession: vi.fn(),
  isAuthenticated: vi.fn(),
  loginThrottleStatus: vi.fn(),
  recordLoginFailure: vi.fn(),
  setAdminPassword: vi.fn(),
  verifyAdminPassword: vi.fn()
}));

const settingsPageMocks = vi.hoisted(() => ({
  loadSettingsData: vi.fn(),
  listAiModels: vi.fn(),
  required: vi.fn(),
  testSmtpSettings: vi.fn(),
  aiApiKeyForModelLoad: vi.fn(),
  getAiApiKey: vi.fn(),
  getSettings: vi.fn(),
  updateAgentAccessSettings: vi.fn(),
  updateAgentPermissionSettings: vi.fn(),
  updateAiSettings: vi.fn(),
  updateDeliverySettings: vi.fn(),
  updateProfileSettings: vi.fn(),
  updateRemoteAccessSettings: vi.fn(),
  updateSmtpSettings: vi.fn(),
  updateVocabularySettings: vi.fn()
}));

vi.mock('$lib/server/external-sign-on', () => externalSignOnMocks);
vi.mock('$lib/server/auth', () => authMocks);
vi.mock('$lib/server/page-data', () => ({ loadSettingsData: settingsPageMocks.loadSettingsData }));
vi.mock('$lib/server/llm', () => ({ listAiModels: settingsPageMocks.listAiModels }));
vi.mock('$lib/server/form-utils', () => ({ required: settingsPageMocks.required }));
vi.mock('$lib/server/mailer', () => ({ testSmtpSettings: settingsPageMocks.testSmtpSettings }));
vi.mock('$lib/server/settings', () => ({
  aiApiKeyForModelLoad: settingsPageMocks.aiApiKeyForModelLoad,
  getAiApiKey: settingsPageMocks.getAiApiKey,
  getSettings: settingsPageMocks.getSettings,
  updateAgentAccessSettings: settingsPageMocks.updateAgentAccessSettings,
  updateAgentPermissionSettings: settingsPageMocks.updateAgentPermissionSettings,
  updateAiSettings: settingsPageMocks.updateAiSettings,
  updateDeliverySettings: settingsPageMocks.updateDeliverySettings,
  updateProfileSettings: settingsPageMocks.updateProfileSettings,
  updateRemoteAccessSettings: settingsPageMocks.updateRemoteAccessSettings,
  updateSmtpSettings: settingsPageMocks.updateSmtpSettings,
  updateVocabularySettings: settingsPageMocks.updateVocabularySettings
}));

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

function actionEvent(entries: Record<string, string>) {
  return {
    cookies: { marker: 'cookies' },
    request: new Request('https://app.example.com/settings', {
      method: 'POST',
      body: new URLSearchParams(entries)
    })
  };
}

function baseSettings() {
  return {
    publicBaseUrl: '',
    smtpAuthMethod: 'password',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpFrom: '',
    microsoftTenantId: 'common',
    aiBaseUrl: '',
    aiModel: ''
  };
}

function externalSignOnStatus(overrides: Record<string, unknown> = {}) {
  return {
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
    entraClientSecretConfigured: false,
    ...overrides
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
    externalSignOnMocks.consumeExternalSignOnLinkAllowance.mockReturnValue(false);
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
    externalSignOnMocks.getExternalSignOnStatus.mockReturnValue(externalSignOnStatus());
    externalSignOnMocks.updateExternalSignOnProviderSettings.mockImplementation((input) => {
      externalSignOnMocks.getExternalSignOnStatus.mockReturnValue(
        externalSignOnStatus({
          provider: input.provider,
          googleClientId: input.googleClientId,
          googleClientSecretConfigured: Boolean(input.googleClientSecret),
          entraTenant: input.entraTenant || 'common',
          entraClientId: input.entraClientId,
          entraClientSecretConfigured: Boolean(input.entraClientSecret)
        })
      );
    });
    authMocks.isAuthenticated.mockReturnValue(false);
    authMocks.loginThrottleStatus.mockReturnValue({ limited: false, retryAfterSeconds: 0 });
    authMocks.verifyAdminPassword.mockReturnValue(false);
    settingsPageMocks.loadSettingsData.mockReturnValue({ settings: baseSettings() });
  });

  test('login load returns disabled external sign-on status when no identity is linked', async () => {
    const status = externalSignOnStatus();
    externalSignOnMocks.getExternalSignOnStatus.mockReturnValue(status);
    const { load } = await import('../src/routes/login/+page.server');

    const result = load({ url: new URL('https://app.example.com/login') } as never);

    expect(result).toEqual({
      externalSignOn: status,
      externalError: false
    });
  });

  test('login load returns linked provider details for external sign-on', async () => {
    const status = externalSignOnStatus({
      enabled: true,
      provider: 'google',
      providerLabel: 'Google',
      email: 'owner@example.com',
      linkedAt: '2026-06-22T12:00:00.000Z'
    });
    externalSignOnMocks.getExternalSignOnStatus.mockReturnValue(status);
    const { load } = await import('../src/routes/login/+page.server');

    const result = load({ url: new URL('https://app.example.com/login') } as never);

    expect(result).toMatchObject({
      externalSignOn: {
        enabled: true,
        provider: 'google',
        providerLabel: 'Google'
      },
      externalError: false
    });
  });

  test('login load maps external error query to generic error state', async () => {
    const { load } = await import('../src/routes/login/+page.server');

    expect(load({ url: new URL('https://app.example.com/login?error=external') } as never)).toMatchObject({
      externalError: true
    });
    expect(load({ url: new URL('https://app.example.com/login?error=provider-detail') } as never)).toMatchObject({
      externalError: false
    });
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

  test('authenticated link start without password-confirmed marker redirects without storing request', async () => {
    authMocks.isAuthenticated.mockReturnValue(true);
    const { GET } = await import('../src/routes/auth/external/[provider]/start/+server');
    const routeEvent = event({
      url: 'https://app.example.com/auth/external/google/start?mode=link'
    });

    await expectRedirect(GET(routeEvent as never), 303, '/login?error=external');

    expect(externalSignOnMocks.consumeExternalSignOnLinkAllowance).toHaveBeenCalledWith(routeEvent.cookies);
    expect(externalSignOnMocks.storeExternalSignOnRequest).not.toHaveBeenCalled();
    expect(externalSignOnMocks.createExternalSignOnAuthorizationUrl).not.toHaveBeenCalled();
  });

  test('authenticated link start with password-confirmed marker stores a transient request and redirects to provider URL', async () => {
    authMocks.isAuthenticated.mockReturnValue(true);
    externalSignOnMocks.consumeExternalSignOnLinkAllowance.mockReturnValue(true);
    const { GET } = await import('../src/routes/auth/external/[provider]/start/+server');
    const routeEvent = event({
      url: 'https://app.example.com/auth/external/google/start?mode=link'
    });

    await expectRedirect(
      GET(routeEvent as never),
      303,
      'https://provider.example.com/authorize?state=state-token'
    );

    expect(externalSignOnMocks.consumeExternalSignOnLinkAllowance).toHaveBeenCalledWith(routeEvent.cookies);
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

describe('settings external sign-on actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    externalSignOnMocks.isExternalSignOnProvider.mockImplementation(
      (provider: string) => provider === 'google' || provider === 'entra'
    );
    externalSignOnMocks.externalSignOnRedirectUri.mockImplementation(
      (origin: string, provider: string) => `${origin}/auth/external/${provider}/callback`
    );
    externalSignOnMocks.getExternalSignOnStatus.mockReturnValue(externalSignOnStatus());
    externalSignOnMocks.updateExternalSignOnProviderSettings.mockImplementation((input) => {
      externalSignOnMocks.getExternalSignOnStatus.mockReturnValue(
        externalSignOnStatus({
          provider: input.provider,
          googleClientId: input.googleClientId,
          googleClientSecretConfigured: Boolean(input.googleClientSecret),
          entraTenant: input.entraTenant || 'common',
          entraClientId: input.entraClientId,
          entraClientSecretConfigured: Boolean(input.entraClientSecret)
        })
      );
    });
    authMocks.verifyAdminPassword.mockReturnValue(false);
    settingsPageMocks.loadSettingsData.mockReturnValue({ settings: baseSettings() });
  });

  test('settings load returns external sign-on status, redirect URIs, and link result state', async () => {
    const status = externalSignOnStatus({ provider: 'google', googleClientId: 'google-client' });
    externalSignOnMocks.getExternalSignOnStatus.mockReturnValue(status);
    const { load } = await import('../src/routes/settings/+page.server');

    const result = load({ url: new URL('https://app.example.com/settings?section=security&externalSignOn=linked') } as never);

    expect(result).toMatchObject({
      openSection: 'security',
      externalSignOnLinked: true,
      externalSignOn: status,
      externalSignOnRedirectUris: {
        google: 'https://app.example.com/auth/external/google/callback',
        entra: 'https://app.example.com/auth/external/entra/callback'
      }
    });
    expect(externalSignOnMocks.externalSignOnRedirectUri).toHaveBeenCalledWith('https://app.example.com', 'google');
    expect(externalSignOnMocks.externalSignOnRedirectUri).toHaveBeenCalledWith('https://app.example.com', 'entra');
  });

  test('updateRemoteAccess reports validation errors without saving a success message', async () => {
    settingsPageMocks.updateRemoteAccessSettings.mockImplementationOnce(() => {
      throw new Error('Public base URL must be a valid HTTP or HTTPS URL.');
    });
    const { actions } = await import('../src/routes/settings/+page.server');

    const result = await actions.updateRemoteAccess(actionEvent({ publicBaseUrl: 'not-a-url' }) as never);

    expect(result).toMatchObject({
      status: 400,
      data: { message: 'Public base URL must be a valid HTTP or HTTPS URL.' }
    });
  });

  test('removeExternalSignOn requires local admin password and leaves provider config untouched on failure', async () => {
    externalSignOnMocks.getExternalSignOnStatus.mockReturnValue(
      externalSignOnStatus({
        enabled: true,
        provider: 'google',
        googleClientId: 'google-client',
        googleClientSecretConfigured: true
      })
    );
    const { actions } = await import('../src/routes/settings/+page.server');

    const result = await actions.removeExternalSignOn(actionEvent({ currentPassword: 'wrong-password' }) as never);

    expect(result).toMatchObject({
      status: 400,
      data: { message: 'Enter the current local admin password before removing external sign-on.' }
    });
    expect(authMocks.verifyAdminPassword).toHaveBeenCalledWith('wrong-password');
    expect(externalSignOnMocks.clearExternalSignOnIdentity).not.toHaveBeenCalled();
    expect(externalSignOnMocks.updateExternalSignOnProviderSettings).not.toHaveBeenCalled();
  });

  test('saveExternalSignOnProvider requires local admin password before saving settings', async () => {
    const { actions } = await import('../src/routes/settings/+page.server');

    const result = await actions.saveExternalSignOnProvider(
      actionEvent({
        externalSignOnProvider: 'google',
        googleClientId: 'google-client',
        googleClientSecret: 'google-secret',
        currentPassword: 'wrong-password'
      }) as never
    );

    expect(result).toMatchObject({
      status: 400,
      data: { message: 'Enter the current local admin password before saving external sign-on settings.' }
    });
    expect(authMocks.verifyAdminPassword).toHaveBeenCalledWith('wrong-password');
    expect(externalSignOnMocks.updateExternalSignOnProviderSettings).not.toHaveBeenCalled();
  });

  test('changePassword requires current local admin password before replacing password', async () => {
    const { actions } = await import('../src/routes/settings/+page.server');

    const result = await actions.changePassword(
      actionEvent({
        currentPassword: 'wrong-password',
        password: 'new local password'
      }) as never
    );

    expect(result).toMatchObject({
      status: 403,
      data: { message: 'Enter the current local admin password before changing the password.' }
    });
    expect(authMocks.verifyAdminPassword).toHaveBeenCalledWith('wrong-password');
    expect(authMocks.setAdminPassword).not.toHaveBeenCalled();
  });

  test('changePassword updates password after current password verification', async () => {
    authMocks.verifyAdminPassword.mockReturnValue(true);
    const { actions } = await import('../src/routes/settings/+page.server');

    await expect(
      actions.changePassword(
        actionEvent({
          currentPassword: 'correct-password',
          password: 'new local password'
        }) as never
      )
    ).resolves.toEqual({ message: 'Admin password updated.' });

    expect(authMocks.verifyAdminPassword).toHaveBeenCalledWith('correct-password');
    expect(authMocks.setAdminPassword).toHaveBeenCalledWith('new local password');
  });

  test('saveExternalSignOnProvider saves settings after local admin password verification', async () => {
    authMocks.verifyAdminPassword.mockReturnValue(true);
    const { actions } = await import('../src/routes/settings/+page.server');

    await expect(
      actions.saveExternalSignOnProvider(
        actionEvent({
          externalSignOnProvider: 'entra',
          entraTenant: 'contoso.onmicrosoft.com',
          entraClientId: 'entra-client',
          entraClientSecret: 'entra-secret',
          currentPassword: 'correct-password'
        }) as never
      )
    ).resolves.toEqual({ message: 'External sign-on provider settings saved.' });

    expect(authMocks.verifyAdminPassword).toHaveBeenCalledWith('correct-password');
    expect(externalSignOnMocks.updateExternalSignOnProviderSettings).toHaveBeenCalledWith({
      provider: 'entra',
      googleClientId: '',
      googleClientSecret: '',
      entraTenant: 'contoso.onmicrosoft.com',
      entraClientId: 'entra-client',
      entraClientSecret: 'entra-secret'
    });
  });

  test('connectExternalSignOn requires local admin password before redirect', async () => {
    const { actions } = await import('../src/routes/settings/+page.server');

    const result = await actions.connectExternalSignOn(
      actionEvent({
        externalSignOnProvider: 'google',
        googleClientId: 'google-client',
        googleClientSecret: 'google-secret',
        currentPassword: ''
      }) as never
    );

    expect(result).toMatchObject({
      status: 400,
      data: { message: 'Enter the current local admin password before connecting external sign-on.' }
    });
    expect(externalSignOnMocks.updateExternalSignOnProviderSettings).not.toHaveBeenCalled();
  });

  test('connectExternalSignOn does not save incomplete provider settings after password verification', async () => {
    authMocks.verifyAdminPassword.mockReturnValue(true);
    const existingStatus = externalSignOnStatus({
      provider: 'google',
      googleClientId: 'existing-google-client',
      googleClientSecretConfigured: true
    });
    externalSignOnMocks.getExternalSignOnStatus.mockReturnValue(existingStatus);
    const { actions } = await import('../src/routes/settings/+page.server');

    const result = await actions.connectExternalSignOn(
      actionEvent({
        externalSignOnProvider: 'google',
        googleClientId: '',
        googleClientSecret: '',
        currentPassword: 'correct-password'
      }) as never
    );

    expect(result).toMatchObject({
      status: 400,
      data: { message: 'Enter the selected provider client ID and client secret before connecting external sign-on.' }
    });
    expect(authMocks.verifyAdminPassword).toHaveBeenCalledWith('correct-password');
    expect(externalSignOnMocks.updateExternalSignOnProviderSettings).not.toHaveBeenCalled();
    expect(externalSignOnMocks.getExternalSignOnStatus.mock.results.every((result) => result.value === existingStatus)).toBe(true);
    expect(externalSignOnMocks.allowExternalSignOnLink).not.toHaveBeenCalled();
  });

  test('connectExternalSignOn preserves a blank secret for matching existing Google provider config', async () => {
    authMocks.verifyAdminPassword.mockReturnValue(true);
    externalSignOnMocks.getExternalSignOnStatus.mockReturnValue(
      externalSignOnStatus({
        provider: 'google',
        googleClientId: 'existing-google-client',
        googleClientSecretConfigured: true
      })
    );
    const { actions } = await import('../src/routes/settings/+page.server');

    await expectRedirect(
      actions.connectExternalSignOn(
        actionEvent({
          externalSignOnProvider: 'google',
          googleClientId: 'existing-google-client',
          googleClientSecret: '',
          currentPassword: 'correct-password'
        }) as never
      ),
      303,
      '/auth/external/google/start?mode=link'
    );

    expect(externalSignOnMocks.updateExternalSignOnProviderSettings).toHaveBeenCalledWith({
      provider: 'google',
      googleClientId: 'existing-google-client',
      googleClientSecret: '',
      entraTenant: '',
      entraClientId: '',
      entraClientSecret: ''
    });
    expect(externalSignOnMocks.allowExternalSignOnLink).toHaveBeenCalledWith({ marker: 'cookies' });
  });

  test('connectExternalSignOn saves provider settings and redirects to provider link start', async () => {
    authMocks.verifyAdminPassword.mockReturnValue(true);
    const { actions } = await import('../src/routes/settings/+page.server');

    await expectRedirect(
      actions.connectExternalSignOn(
        actionEvent({
          externalSignOnProvider: 'entra',
          entraTenant: 'contoso.onmicrosoft.com',
          entraClientId: 'entra-client',
          entraClientSecret: 'entra-secret',
          currentPassword: 'correct-password'
        }) as never
      ),
      303,
      '/auth/external/entra/start?mode=link'
    );

    expect(authMocks.verifyAdminPassword).toHaveBeenCalledWith('correct-password');
    expect(externalSignOnMocks.updateExternalSignOnProviderSettings).toHaveBeenCalledWith({
      provider: 'entra',
      googleClientId: '',
      googleClientSecret: '',
      entraTenant: 'contoso.onmicrosoft.com',
      entraClientId: 'entra-client',
      entraClientSecret: 'entra-secret'
    });
    expect(externalSignOnMocks.allowExternalSignOnLink).toHaveBeenCalledWith({ marker: 'cookies' });
  });
});
