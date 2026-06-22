import { createHash, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { repo } from './app';
import { decryptSecret, encryptSecret } from './crypto';

export type ExternalSignOnCookies = Cookies;

export type ExternalSignOnProvider = 'google' | 'entra';

export type ExternalSignOnMode = 'login' | 'link';

export type ExternalSignOnRequest = {
  provider: ExternalSignOnProvider;
  mode: ExternalSignOnMode;
  state: string;
  nonce: string;
  codeVerifier: string;
};

export type ExternalSignOnAuthorizationInput = {
  origin: string;
  provider: ExternalSignOnProvider;
  mode: ExternalSignOnMode;
  state: string;
  nonce: string;
  codeChallenge: string;
};

export type ExternalSignOnStatus = {
  enabled: boolean;
  provider: ExternalSignOnProvider | '';
  providerLabel: string;
  email: string;
  name: string;
  linkedAt: string;
  googleClientId: string;
  googleClientSecretConfigured: boolean;
  entraTenant: string;
  entraClientId: string;
  entraClientSecretConfigured: boolean;
};

export type ExternalSignOnProviderSettingsInput = {
  provider: string;
  googleClientId: string;
  googleClientSecret: string;
  entraTenant: string;
  entraClientId: string;
  entraClientSecret: string;
};

const providerLabels: Record<ExternalSignOnProvider, string> = {
  google: 'Google',
  entra: 'Microsoft Entra ID'
};

const signOnRequestCookieNames = {
  provider: 'tcs_sso_provider',
  mode: 'tcs_sso_mode',
  state: 'tcs_sso_state',
  nonce: 'tcs_sso_nonce',
  codeVerifier: 'tcs_sso_code_verifier'
} as const;

const expiredSignOnRequestMessage = 'The sign-on request expired. Start again.';

export function isExternalSignOnProvider(value: string): value is ExternalSignOnProvider {
  return value === 'google' || value === 'entra';
}

export function getExternalSignOnStatus(): ExternalSignOnStatus {
  const providerSetting = repo.getSetting('auth.sso.provider');
  const provider = isExternalSignOnProvider(providerSetting) ? providerSetting : '';
  const subject = repo.getSetting('auth.sso.subject');

  return {
    enabled: Boolean(provider && subject),
    provider,
    providerLabel: provider ? providerLabels[provider] : '',
    email: repo.getSetting('auth.sso.email'),
    name: repo.getSetting('auth.sso.name'),
    linkedAt: repo.getSetting('auth.sso.linkedAt'),
    googleClientId: repo.getSetting('auth.sso.google.clientId'),
    googleClientSecretConfigured: Boolean(repo.getSetting('auth.sso.google.clientSecret')),
    entraTenant: repo.getSetting('auth.sso.entra.tenant') || 'common',
    entraClientId: repo.getSetting('auth.sso.entra.clientId'),
    entraClientSecretConfigured: Boolean(repo.getSetting('auth.sso.entra.clientSecret'))
  };
}

export function getExternalSignOnClientSecret(provider: ExternalSignOnProvider) {
  return decryptSecret(repo.getSetting(clientSecretSettingKey(provider)));
}

export function externalSignOnRedirectUri(origin: string, provider: ExternalSignOnProvider) {
  const baseUrl = repo.getSetting('server.publicBaseUrl') || origin;
  return `${baseUrl.replace(/\/$/, '')}/auth/external/${provider}/callback`;
}

export function createExternalSignOnAuthorizationUrl(input: ExternalSignOnAuthorizationInput) {
  const clientId = repo.getSetting(clientIdSettingKey(input.provider));
  const clientSecret = getExternalSignOnClientSecret(input.provider);
  const action = input.mode === 'link' ? 'connecting sign-on' : 'signing in';

  if (!clientId) {
    throw new Error(`Configure the ${providerLabels[input.provider]} client ID before ${action}.`);
  }
  if (!clientSecret) {
    throw new Error(`Configure the ${providerLabels[input.provider]} client secret before ${action}.`);
  }

  const url = new URL(authorizationEndpoint(input.provider));
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', externalSignOnRedirectUri(input.origin, input.provider));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', input.state);
  url.searchParams.set('nonce', input.nonce);
  url.searchParams.set('code_challenge', input.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url;
}

export function updateExternalSignOnProviderSettings(input: ExternalSignOnProviderSettingsInput) {
  const provider = clean(input.provider);
  if (!isExternalSignOnProvider(provider)) {
    throw new Error('Choose Google or Microsoft Entra ID.');
  }

  repo.setSetting('auth.sso.provider', provider);

  if (provider === 'google') {
    repo.setSetting('auth.sso.google.clientId', clean(input.googleClientId));
    const googleClientSecret = clean(input.googleClientSecret);
    if (googleClientSecret) {
      repo.setSetting('auth.sso.google.clientSecret', encryptSecret(googleClientSecret));
    }
    return;
  }

  repo.setSetting('auth.sso.entra.tenant', clean(input.entraTenant) || 'common');
  repo.setSetting('auth.sso.entra.clientId', clean(input.entraClientId));
  const entraClientSecret = clean(input.entraClientSecret);
  if (entraClientSecret) {
    repo.setSetting('auth.sso.entra.clientSecret', encryptSecret(entraClientSecret));
  }
}

export function storeExternalSignOnRequest(
  cookies: ExternalSignOnCookies,
  request: ExternalSignOnRequest
) {
  const options = signOnRequestCookieOptions();
  cookies.set(signOnRequestCookieNames.provider, request.provider, options);
  cookies.set(signOnRequestCookieNames.mode, request.mode, options);
  cookies.set(signOnRequestCookieNames.state, request.state, options);
  cookies.set(signOnRequestCookieNames.nonce, request.nonce, options);
  cookies.set(signOnRequestCookieNames.codeVerifier, request.codeVerifier, options);
}

export function consumeExternalSignOnRequest(
  cookies: ExternalSignOnCookies,
  provider: ExternalSignOnProvider
): ExternalSignOnRequest {
  const storedProvider = cookies.get(signOnRequestCookieNames.provider) ?? '';
  const mode = cookies.get(signOnRequestCookieNames.mode) ?? '';
  const state = cookies.get(signOnRequestCookieNames.state) ?? '';
  const nonce = cookies.get(signOnRequestCookieNames.nonce) ?? '';
  const codeVerifier = cookies.get(signOnRequestCookieNames.codeVerifier) ?? '';

  clearExternalSignOnRequest(cookies);

  if (
    storedProvider !== provider ||
    !isExternalSignOnProvider(storedProvider) ||
    !isExternalSignOnMode(mode) ||
    !state ||
    !nonce ||
    !codeVerifier
  ) {
    throw new Error(expiredSignOnRequestMessage);
  }

  return {
    provider: storedProvider,
    mode,
    state,
    nonce,
    codeVerifier
  };
}

export function randomUrlToken() {
  return randomBytes(32).toString('base64url');
}

export function pkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

function clientSecretSettingKey(provider: ExternalSignOnProvider) {
  return `auth.sso.${provider}.clientSecret`;
}

function clientIdSettingKey(provider: ExternalSignOnProvider) {
  return `auth.sso.${provider}.clientId`;
}

function authorizationEndpoint(provider: ExternalSignOnProvider) {
  if (provider === 'google') {
    return 'https://accounts.google.com/o/oauth2/v2/auth';
  }

  const tenant = repo.getSetting('auth.sso.entra.tenant') || 'common';
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`;
}

function clearExternalSignOnRequest(cookies: ExternalSignOnCookies) {
  for (const name of Object.values(signOnRequestCookieNames)) {
    cookies.delete(name, { path: '/' });
  }
}

function signOnRequestCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 10 * 60,
    secure: process.env.SCUBA_EMAIL_SECURE_COOKIES === 'true'
  } as const;
}

function isExternalSignOnMode(value: string): value is ExternalSignOnMode {
  return value === 'login' || value === 'link';
}

function clean(value: string) {
  return value.trim();
}
