import { beforeEach, describe, expect, test, vi } from 'vitest';
import { encryptSecret } from '../src/lib/server/crypto';

const settings = new Map<string, string>();

vi.mock('../src/lib/server/app', () => ({
  repo: {
    getSetting: (key: string) => settings.get(key) ?? '',
    setSetting: (key: string, value: string) => settings.set(key, value),
    deleteSetting: (key: string) => settings.delete(key),
    __clear: () => settings.clear()
  }
}));

describe('external sign-on status', () => {
  beforeEach(() => {
    settings.clear();
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
    expect(url.searchParams.get('client_id')).toBe('google-client');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-token');
    expect(url.searchParams.get('nonce')).toBe('nonce-token');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-token');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.has('access_type')).toBe(false);
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
    expect(url.searchParams.get('scope')).toBe('openid email profile');
  });
});
