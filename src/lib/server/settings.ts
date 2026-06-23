import { repo } from './app';
import { decryptSecret, encryptSecret } from './crypto';
import { normalizeThemeMode, type ThemeMode } from '../shared/theme';
import { formText } from './form-utils';
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
  outboundKillSwitchEnabled: boolean;
  outboundDirectMaxRecipients: number;
  outboundPacingSeconds: number;
  outboundMaxPerMinute: number;
  outboundMaxPerHour: number;
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
    outboundKillSwitchEnabled: repo.getSetting('outbound.killSwitchEnabled') === 'true',
    outboundDirectMaxRecipients: cappedInt(repo.getSetting('outbound.directMaxRecipients'), 12, 1, 25),
    outboundPacingSeconds: cappedInt(repo.getSetting('outbound.pacingSeconds'), 5, 2, 300),
    outboundMaxPerMinute: cappedInt(repo.getSetting('outbound.maxPerMinute'), 10, 1, 30),
    outboundMaxPerHour: cappedInt(repo.getSetting('outbound.maxPerHour'), 50, 1, 300),
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
  set('outbound.killSwitchEnabled', checked(form, 'outboundKillSwitchEnabled'));
  set('outbound.directMaxRecipients', String(cappedInt(form.get('outboundDirectMaxRecipients'), 12, 1, 25)));
  set('outbound.pacingSeconds', String(cappedInt(form.get('outboundPacingSeconds'), 5, 2, 300)));
  set('outbound.maxPerMinute', String(cappedInt(form.get('outboundMaxPerMinute'), 10, 1, 30)));
  set('outbound.maxPerHour', String(cappedInt(form.get('outboundMaxPerHour'), 50, 1, 300)));
}

export function updateRemoteAccessSettings(form: FormData) {
  set('server.publicBaseUrl', normalizedPublicBaseUrl(form.get('publicBaseUrl')));
  set('server.remoteAccessEnabled', checked(form, 'remoteAccessEnabled'));
  set('server.trustedProxyEnabled', checked(form, 'trustedProxyEnabled'));
}

export function normalizedPublicBaseUrl(value: FormDataEntryValue | null) {
  if (value === null) return '';
  if (typeof value !== 'string') {
    throw new TypeError('Public base URL must be a valid HTTP or HTTPS URL.');
  }

  const input = value.trim();
  if (!input) return '';

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Public base URL must be a valid HTTP or HTTPS URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Public base URL must be a valid HTTP or HTTPS URL.');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Public base URL must include only the scheme and host.');
  }

  return url.origin;
}

export function updateSmtpSettings(form: FormData) {
  set('smtp.host', form.get('smtpHost'));
  set('smtp.port', form.get('smtpPort') || '587');
  set('smtp.user', form.get('smtpUser'));
  set('smtp.from', form.get('smtpFrom'));
  set('smtp.authMethod', form.get('smtpAuthMethod') || 'password');
  if (form.has('microsoftTenantId')) set('microsoft.tenantId', form.get('microsoftTenantId') || 'common');
  if (form.has('microsoftClientId')) set('microsoft.clientId', form.get('microsoftClientId'));

  const smtpPassword = formText(form.get('smtpPassword'));
  if (smtpPassword) repo.setSetting('smtp.password', encryptSecret(smtpPassword));
  const microsoftClientSecret = formText(form.get('microsoftClientSecret'));
  if (microsoftClientSecret) repo.setSetting('microsoft.clientSecret', encryptSecret(microsoftClientSecret));
}

export function updateAiSettings(form: FormData) {
  set('ai.enabled', checked(form, 'aiEnabled'));
  set('ai.visionEnabled', checked(form, 'aiVisionEnabled'));
  set('ai.baseUrl', form.get('aiBaseUrl'));
  set('ai.model', form.get('aiModel'));

  const aiApiKey = formText(form.get('aiApiKey'));
  if (aiApiKey) repo.setSetting('ai.apiKey', encryptSecret(aiApiKey));
}

export function updateReplySyncSettings(form: FormData) {
  set('replySync.host', form.get('replySyncHost'));
  set('replySync.port', form.get('replySyncPort') || '993');
  set('replySync.tls', checked(form, 'replySyncTls'));
  set('replySync.username', form.get('replySyncUsername'));
  set('replySync.pollingEnabled', checked(form, 'replySyncPollingEnabled'));

  const postedPassword = form.get('replySyncPassword');
  const password = typeof postedPassword === 'string' ? postedPassword : '';
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
    courseTypeLabel: formText(form.get('courseTypeLabel')),
    courseTypePluralLabel: formText(form.get('courseTypePluralLabel')),
    classSessionLabel: formText(form.get('classSessionLabel')),
    classSessionPluralLabel: formText(form.get('classSessionPluralLabel')),
    studentLabel: formText(form.get('studentLabel')),
    studentPluralLabel: formText(form.get('studentPluralLabel')),
    instructorLabel: formText(form.get('instructorLabel')),
    instructorPluralLabel: formText(form.get('instructorPluralLabel'))
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
  repo.setSetting(key, formText(value).trim());
}

function checked(form: FormData, key: string) {
  return form.get(key) === 'on' ? 'true' : 'false';
}

function normalizeBaseUrl(value: string) {
  let normalized = value.trim();
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function cappedInt(value: FormDataEntryValue | string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(formText(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
