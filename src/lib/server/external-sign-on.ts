import { createHash, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import * as oidc from 'openid-client';
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

export type ExternalSignOnClaims = { sub: string; email?: string; name?: string };

export type ExternalSignOnCallbackInput = {
  origin: string;
  provider: ExternalSignOnProvider;
  code: string;
  state: string;
  codeVerifier: string;
  nonce: string;
};

export type OidcAdapter = {
  exchange: (
    input: ExternalSignOnCallbackInput & {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    }
  ) => Promise<ExternalSignOnClaims>;
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

const linkAllowanceCookieName = 'tcs_sso_link_allowed';
const linkAllowanceMaxAgeSeconds = 5 * 60;
const expiredSignOnRequestMessage = 'The sign-on request expired. Start again.';

let oidcAdapter: OidcAdapter | undefined;

export function setExternalSignOnOidcAdapterForTests(adapter: OidcAdapter | undefined) {
  oidcAdapter = adapter;
}

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

export function linkExternalSignOnIdentity(
  provider: ExternalSignOnProvider,
  claims: ExternalSignOnClaims
) {
  const subject = typeof claims.sub === 'string' ? claims.sub : '';
  if (!clean(subject)) {
    throw new Error('The provider did not return an account identifier.');
  }

  repo.setSetting('auth.sso.provider', provider);
  repo.setSetting('auth.sso.subject', subject);
  repo.setSetting('auth.sso.email', clean(claims.email ?? ''));
  repo.setSetting('auth.sso.name', clean(claims.name ?? ''));
  repo.setSetting('auth.sso.linkedAt', new Date().toISOString());
}

export function assertExternalSignOnIdentityMatches(
  provider: ExternalSignOnProvider,
  claims: ExternalSignOnClaims
) {
  const status = getExternalSignOnStatus();
  const subject = typeof claims.sub === 'string' ? claims.sub : '';

  if (
    !status.enabled ||
    status.provider !== provider ||
    repo.getSetting('auth.sso.subject') !== subject
  ) {
    throw new Error('That account is not linked to this app.');
  }
}

export function clearExternalSignOnIdentity() {
  repo.deleteSetting('auth.sso.subject');
  repo.deleteSetting('auth.sso.email');
  repo.deleteSetting('auth.sso.name');
  repo.deleteSetting('auth.sso.linkedAt');
}

export async function exchangeExternalSignOnCode(
  input: ExternalSignOnCallbackInput
): Promise<ExternalSignOnClaims> {
  const clientId = clean(repo.getSetting(clientIdSettingKey(input.provider)));
  const clientSecret = clean(getExternalSignOnClientSecret(input.provider));
  const redirectUri = externalSignOnRedirectUri(input.origin, input.provider);

  if (!clientId || !clientSecret) {
    throw new Error('External sign-on provider settings are incomplete.');
  }

  const claims = await (oidcAdapter ?? defaultOidcAdapter).exchange({
    ...input,
    clientId,
    clientSecret,
    redirectUri
  });

  if (typeof claims.sub !== 'string' || !clean(claims.sub)) {
    throw new Error('The provider did not return an account identifier.');
  }

  return claims;
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

export function allowExternalSignOnLink(cookies: ExternalSignOnCookies) {
  const token = randomUrlToken();
  repo.setSetting(
    linkAllowanceSettingKey(token),
    new Date(Date.now() + linkAllowanceMaxAgeSeconds * 1000).toISOString()
  );
  cookies.set(linkAllowanceCookieName, token, linkAllowanceCookieOptions());
}

export function consumeExternalSignOnLinkAllowance(cookies: ExternalSignOnCookies) {
  const token = cookies.get(linkAllowanceCookieName) ?? '';
  cookies.delete(linkAllowanceCookieName, { path: '/' });
  if (!token) return false;

  const key = linkAllowanceSettingKey(token);
  const expiresAt = repo.getSetting(key);
  if (expiresAt) repo.deleteSetting(key);

  const expiresTime = new Date(expiresAt).getTime();
  return Number.isFinite(expiresTime) && expiresTime > Date.now();
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

function linkAllowanceSettingKey(token: string) {
  return `auth.sso.linkAllowance.${createHash('sha256').update(token).digest('hex')}`;
}

function authorizationEndpoint(provider: ExternalSignOnProvider) {
  if (provider === 'google') {
    return 'https://accounts.google.com/o/oauth2/v2/auth';
  }

  const tenant = repo.getSetting('auth.sso.entra.tenant') || 'common';
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`;
}

const defaultOidcAdapter: OidcAdapter = {
  async exchange(input) {
    const config = await oidc.discovery(
      issuerUrl(input.provider),
      input.clientId,
      {
        client_secret: input.clientSecret,
        redirect_uris: [input.redirectUri],
        response_types: ['code']
      },
      oidc.ClientSecretPost(input.clientSecret)
    );
    const callbackUrl = new URL(input.redirectUri);
    callbackUrl.searchParams.set('code', input.code);
    callbackUrl.searchParams.set('state', input.state);

    const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
      expectedState: input.state,
      expectedNonce: input.nonce,
      pkceCodeVerifier: input.codeVerifier
    });
    const claims = tokens.claims();

    return {
      sub: typeof claims?.sub === 'string' ? claims.sub : '',
      email: typeof claims?.email === 'string' ? claims.email : undefined,
      name: typeof claims?.name === 'string' ? claims.name : undefined
    };
  }
};

function issuerUrl(provider: ExternalSignOnProvider) {
  if (provider === 'google') {
    return new URL('https://accounts.google.com');
  }

  const tenant = repo.getSetting('auth.sso.entra.tenant') || 'common';
  return new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/v2.0`);
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

function linkAllowanceCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: linkAllowanceMaxAgeSeconds,
    secure: process.env.SCUBA_EMAIL_SECURE_COOKIES === 'true'
  } as const;
}

function isExternalSignOnMode(value: string): value is ExternalSignOnMode {
  return value === 'login' || value === 'link';
}

function clean(value: string) {
  return value.trim();
}
