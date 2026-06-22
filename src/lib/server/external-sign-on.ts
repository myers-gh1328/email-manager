import { createHash, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { repo } from './app';
import { decryptSecret, encryptSecret } from './crypto';

export type ExternalSignOnCookies = Cookies;

export type ExternalSignOnProvider = 'google' | 'entra';

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

export function randomUrlToken() {
  return randomBytes(32).toString('base64url');
}

export function pkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

function clientSecretSettingKey(provider: ExternalSignOnProvider) {
  return `auth.sso.${provider}.clientSecret`;
}

function clean(value: string) {
  return value.trim();
}
