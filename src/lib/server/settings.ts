import { repo } from './app';
import { decryptSecret, encryptSecret } from './crypto';
import { normalizeThemeMode, type ThemeMode } from '../shared/theme';
import {
  agentPermissionKeys,
  defaultAgentPermissions,
  normalizeAgentPermissions,
  settingKeyForAgentPermission,
  type AgentPermissions
} from './agent/permissions';
import { defaultVocabulary, normalizeVocabulary, type VocabularyLabels } from './agent/vocabulary';

export interface AppSettings {
  instructorName: string;
  publicBaseUrl: string;
  schedulerEnabled: boolean;
  emailTestModeEnabled: boolean;
  emailSignature: string;
  remoteAccessEnabled: boolean;
  trustedProxyEnabled: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpFrom: string;
  smtpAuthMethod: string;
  smtpPasswordConfigured: boolean;
  microsoftTenantId: string;
  microsoftClientId: string;
  microsoftClientSecretConfigured: boolean;
  microsoftRefreshTokenConfigured: boolean;
  aiEnabled: boolean;
  aiVisionEnabled: boolean;
  aiBaseUrl: string;
  aiModel: string;
  aiApiKeyConfigured: boolean;
  replySyncHost: string;
  replySyncPort: string;
  replySyncTls: boolean;
  replySyncUsername: string;
  replySyncPasswordConfigured: boolean;
  replySyncPollingEnabled: boolean;
  themeMode: ThemeMode;
  agentEnabled: boolean;
  agentPermissions: AgentPermissions;
  vocabulary: VocabularyLabels;
}

export function getSettings(): AppSettings {
  return {
    instructorName: repo.getSetting('profile.instructorName'),
    publicBaseUrl: repo.getSetting('server.publicBaseUrl'),
    schedulerEnabled: repo.getSetting('scheduler.enabled') === 'true',
    emailTestModeEnabled: repo.getSetting('email.testModeEnabled') === 'true',
    emailSignature: repo.getSetting('email.signature'),
    remoteAccessEnabled: repo.getSetting('server.remoteAccessEnabled') === 'true',
    trustedProxyEnabled: repo.getSetting('server.trustedProxyEnabled') === 'true',
    smtpHost: repo.getSetting('smtp.host'),
    smtpPort: repo.getSetting('smtp.port') || '587',
    smtpUser: repo.getSetting('smtp.user'),
    smtpFrom: repo.getSetting('smtp.from'),
    smtpAuthMethod: repo.getSetting('smtp.authMethod') || 'password',
    smtpPasswordConfigured: Boolean(repo.getSetting('smtp.password')),
    microsoftTenantId: repo.getSetting('microsoft.tenantId') || 'common',
    microsoftClientId: repo.getSetting('microsoft.clientId'),
    microsoftClientSecretConfigured: Boolean(repo.getSetting('microsoft.clientSecret')),
    microsoftRefreshTokenConfigured: Boolean(repo.getSetting('microsoft.refreshToken')),
    aiEnabled: repo.getSetting('ai.enabled') === 'true',
    aiVisionEnabled: repo.getSetting('ai.visionEnabled') === 'true',
    aiBaseUrl: repo.getSetting('ai.baseUrl'),
    aiModel: repo.getSetting('ai.model'),
    aiApiKeyConfigured: Boolean(repo.getSetting('ai.apiKey')),
    replySyncHost: repo.getSetting('replySync.host'),
    replySyncPort: repo.getSetting('replySync.port') || '993',
    replySyncTls: repo.getSetting('replySync.tls') !== 'false',
    replySyncUsername: repo.getSetting('replySync.username'),
    replySyncPasswordConfigured: Boolean(repo.getSetting('replySync.password')),
    replySyncPollingEnabled: repo.getSetting('replySync.pollingEnabled') !== 'false',
    themeMode: normalizeThemeMode(repo.getSetting('ui.themeMode')),
    agentEnabled: repo.getSetting('agent.enabled') === 'true',
    agentPermissions: normalizeAgentPermissions(
      Object.fromEntries(
        agentPermissionKeys.map((key) => [
          key,
          repo.getSetting(settingKeyForAgentPermission(key)) || String(defaultAgentPermissions[key])
        ])
      )
    ),
    vocabulary: normalizeVocabulary({
      courseTypeLabel: repo.getSetting('vocabulary.courseTypeLabel') || defaultVocabulary.courseTypeLabel,
      courseTypePluralLabel: repo.getSetting('vocabulary.courseTypePluralLabel') || defaultVocabulary.courseTypePluralLabel,
      classSessionLabel: repo.getSetting('vocabulary.classSessionLabel') || defaultVocabulary.classSessionLabel,
      classSessionPluralLabel: repo.getSetting('vocabulary.classSessionPluralLabel') || defaultVocabulary.classSessionPluralLabel,
      studentLabel: repo.getSetting('vocabulary.studentLabel') || defaultVocabulary.studentLabel,
      studentPluralLabel: repo.getSetting('vocabulary.studentPluralLabel') || defaultVocabulary.studentPluralLabel,
      instructorLabel: repo.getSetting('vocabulary.instructorLabel') || defaultVocabulary.instructorLabel,
      instructorPluralLabel: repo.getSetting('vocabulary.instructorPluralLabel') || defaultVocabulary.instructorPluralLabel
    })
  };
}

export function updateProfileSettings(form: FormData) {
  set('profile.instructorName', form.get('instructorName'));
  set('email.signature', form.get('emailSignature'));
}

export function updateDeliverySettings(form: FormData) {
  set('scheduler.enabled', checked(form, 'schedulerEnabled'));
  set('email.testModeEnabled', checked(form, 'emailTestModeEnabled'));
}

export function updateRemoteAccessSettings(form: FormData) {
  set('server.publicBaseUrl', form.get('publicBaseUrl'));
  set('server.remoteAccessEnabled', checked(form, 'remoteAccessEnabled'));
  set('server.trustedProxyEnabled', checked(form, 'trustedProxyEnabled'));
}

export function updateSmtpSettings(form: FormData) {
  set('smtp.host', form.get('smtpHost'));
  set('smtp.port', form.get('smtpPort') || '587');
  set('smtp.user', form.get('smtpUser'));
  set('smtp.from', form.get('smtpFrom'));
  set('smtp.authMethod', form.get('smtpAuthMethod') || 'password');
  if (form.has('microsoftTenantId')) set('microsoft.tenantId', form.get('microsoftTenantId') || 'common');
  if (form.has('microsoftClientId')) set('microsoft.clientId', form.get('microsoftClientId'));

  const smtpPassword = String(form.get('smtpPassword') ?? '');
  if (smtpPassword) repo.setSetting('smtp.password', encryptSecret(smtpPassword));
  const microsoftClientSecret = String(form.get('microsoftClientSecret') ?? '');
  if (microsoftClientSecret) repo.setSetting('microsoft.clientSecret', encryptSecret(microsoftClientSecret));
}

export function updateAiSettings(form: FormData) {
  set('ai.enabled', checked(form, 'aiEnabled'));
  set('ai.visionEnabled', checked(form, 'aiVisionEnabled'));
  set('ai.baseUrl', form.get('aiBaseUrl'));
  set('ai.model', form.get('aiModel'));

  const aiApiKey = String(form.get('aiApiKey') ?? '');
  if (aiApiKey) repo.setSetting('ai.apiKey', encryptSecret(aiApiKey));
}

export function updateReplySyncSettings(form: FormData) {
  set('replySync.host', form.get('replySyncHost'));
  set('replySync.port', form.get('replySyncPort') || '993');
  set('replySync.tls', checked(form, 'replySyncTls'));
  set('replySync.username', form.get('replySyncUsername'));
  set('replySync.pollingEnabled', checked(form, 'replySyncPollingEnabled'));

  const password = String(form.get('replySyncPassword') ?? '');
  if (password) repo.setSetting('replySync.password', encryptSecret(password));
}

export function updateAgentAccessSettings(form: FormData) {
  set('agent.enabled', checked(form, 'agentEnabled'));
}

export function updateAgentPermissionSettings(form: FormData) {
  for (const key of agentPermissionKeys) {
    set(settingKeyForAgentPermission(key), checked(form, key));
  }
}

export function updateVocabularySettings(form: FormData) {
  const labels = normalizeVocabulary({
    courseTypeLabel: String(form.get('courseTypeLabel') ?? ''),
    courseTypePluralLabel: String(form.get('courseTypePluralLabel') ?? ''),
    classSessionLabel: String(form.get('classSessionLabel') ?? ''),
    classSessionPluralLabel: String(form.get('classSessionPluralLabel') ?? ''),
    studentLabel: String(form.get('studentLabel') ?? ''),
    studentPluralLabel: String(form.get('studentPluralLabel') ?? ''),
    instructorLabel: String(form.get('instructorLabel') ?? ''),
    instructorPluralLabel: String(form.get('instructorPluralLabel') ?? '')
  });
  for (const [key, value] of Object.entries(labels)) {
    set(`vocabulary.${key}`, value);
  }
}

export function getSmtpPassword() {
  return decryptSecret(repo.getSetting('smtp.password'));
}

export function getMicrosoftClientSecret() {
  return decryptSecret(repo.getSetting('microsoft.clientSecret'));
}

export function getMicrosoftRefreshToken() {
  return decryptSecret(repo.getSetting('microsoft.refreshToken'));
}

export function getAiApiKey() {
  return decryptSecret(repo.getSetting('ai.apiKey'));
}

export function getReplySyncPassword() {
  return decryptSecret(repo.getSetting('replySync.password'));
}

export function aiApiKeyForModelLoad(postedBaseUrl: string, postedApiKey: string, settings: AppSettings, savedApiKey: string) {
  const newKey = postedApiKey.trim();
  if (newKey) return newKey;
  if (!settings.aiApiKeyConfigured) return '';
  return normalizeBaseUrl(postedBaseUrl) === normalizeBaseUrl(settings.aiBaseUrl) ? savedApiKey : '';
}

export function setMicrosoftRefreshToken(refreshToken: string) {
  if (refreshToken) repo.setSetting('microsoft.refreshToken', encryptSecret(refreshToken));
}

export function setThemeMode(value: string) {
  repo.setSetting('ui.themeMode', normalizeThemeMode(value));
}

function set(key: string, value: FormDataEntryValue | null | string | boolean) {
  repo.setSetting(key, String(value ?? '').trim());
}

function checked(form: FormData, key: string) {
  return form.get(key) === 'on' ? 'true' : 'false';
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}
