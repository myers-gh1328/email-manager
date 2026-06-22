import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import type { Cookies } from '@sveltejs/kit';
import { decryptSecret, encryptSecret } from './crypto';
import * as repositoryIndex from './repository/index';

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

type SettingsRepository = {
  getSetting(key: string): string;
};

const repo = resolveRepository();

const providerLabels: Record<ExternalSignOnProvider, string> = {
  google: 'Google',
  entra: 'Microsoft Entra ID'
};

export function isExternalSignOnProvider(value: string): value is ExternalSignOnProvider {
  return value === 'google' || value === 'entra';
}

export function getExternalSignOnStatus(): ExternalSignOnStatus {
  const providerSetting = repo.getSetting('externalSignOn.provider');
  const provider = isExternalSignOnProvider(providerSetting) ? providerSetting : '';

  return {
    enabled: repo.getSetting('externalSignOn.enabled') === 'true',
    provider,
    providerLabel: provider ? providerLabels[provider] : '',
    email: repo.getSetting('externalSignOn.email'),
    name: repo.getSetting('externalSignOn.name'),
    linkedAt: repo.getSetting('externalSignOn.linkedAt'),
    googleClientId: repo.getSetting('externalSignOn.google.clientId'),
    googleClientSecretConfigured: Boolean(repo.getSetting('externalSignOn.google.clientSecret')),
    entraTenant: repo.getSetting('externalSignOn.entra.tenant') || 'common',
    entraClientId: repo.getSetting('externalSignOn.entra.clientId'),
    entraClientSecretConfigured: Boolean(repo.getSetting('externalSignOn.entra.clientSecret'))
  };
}

export function getExternalSignOnClientSecret(provider: ExternalSignOnProvider) {
  return decryptSecret(repo.getSetting(clientSecretSettingKey(provider)));
}

export function randomUrlToken() {
  return randomBytes(32).toString('base64url');
}

export function pkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

function clientSecretSettingKey(provider: ExternalSignOnProvider) {
  return `externalSignOn.${provider}.clientSecret`;
}

function resolveRepository(): SettingsRepository {
  const mockedRepo = (repositoryIndex as unknown as { default?: SettingsRepository }).default;
  if (mockedRepo) return mockedRepo;

  const dataDir = process.env.SCUBA_EMAIL_DATA_DIR ?? join(process.cwd(), 'data');
  const dbPath = process.env.SCUBA_EMAIL_DB ?? join(dataDir, 'scuba-email.sqlite');
  return new repositoryIndex.AppRepository(dbPath);
}
