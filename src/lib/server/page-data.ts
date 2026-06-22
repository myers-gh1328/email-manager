import { repo } from './app';
import { getAppSecretStatus } from './app-secret';
import { getSettings } from './settings';

export function loadDashboardData() {
  const settings = getSettings();
  const campaigns = repo.listCampaigns();
  return {
    stats: repo.stats(),
    campaigns,
    schedulerStatus: schedulerStatus(settings, campaigns),
    remoteStatus: remoteAccessStatus(settings),
    settings
  };
}

export function schedulerStatus(settings: ReturnType<typeof getSettings>, campaigns: ReturnType<typeof repo.listCampaigns>) {
  const approved = campaigns.filter((campaign) => campaign.approved);
  const nextApproved = approved
    .filter((campaign) => new Date(campaign.scheduledFor).getTime() >= Date.now())
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0];
  const dueApprovedCount = approved.filter((campaign) => new Date(campaign.scheduledFor).getTime() <= Date.now()).length;
  const smtpConfigured = Boolean(settings.smtpHost && settings.smtpFrom);
  const smtpAuthConfigured =
    settings.smtpAuthMethod === 'microsoft-oauth2'
      ? Boolean(settings.smtpUser && settings.microsoftRefreshTokenConfigured)
      : Boolean(settings.smtpUser ? settings.smtpPasswordConfigured : true);
  const blockedReasons = [
    !settings.schedulerEnabled ? 'Scheduled sending is disabled' : '',
    settings.emailTestModeEnabled ? 'Email test mode is redirecting outbound mail' : '',
    !smtpConfigured ? 'SMTP is incomplete' : '',
    smtpConfigured && !smtpAuthConfigured && settings.smtpAuthMethod === 'microsoft-oauth2' ? 'Microsoft Outlook is not connected' : '',
    smtpConfigured && !smtpAuthConfigured && settings.smtpAuthMethod !== 'microsoft-oauth2' ? 'SMTP authentication is incomplete' : ''
  ].filter(Boolean);

  return {
    ready: blockedReasons.length === 0,
    blockedReasons,
    dueApprovedCount,
    nextApproved
  };
}

export function remoteAccessStatus(settings: ReturnType<typeof getSettings>) {
  if (!settings.remoteAccessEnabled) {
    return { enabled: false, ready: true, blockedReasons: [] as string[] };
  }
  const appSecret = getAppSecretStatus();
  const blockedReasons = [
    !settings.publicBaseUrl ? 'Set a public base URL for remote access' : '',
    !appSecret.configured ? 'Configure a persistent app secret before remote access' : '',
    process.env.SCUBA_EMAIL_SECURE_COOKIES !== 'true' ? 'Set SCUBA_EMAIL_SECURE_COOKIES=true when serving over HTTPS' : ''
  ].filter(Boolean);
  return {
    enabled: true,
    ready: blockedReasons.length === 0,
    blockedReasons
  };
}

export function loadContactsData(contactId?: string) {
  return {
    contacts: repo.listContacts(),
    selectedContactId: contactId ?? '',
    contactDetail: contactId ? repo.getContactDetail(contactId) : undefined,
    settings: getSettings()
  };
}

export function loadClassesData() {
  return {
    contacts: repo.listContacts(),
    courseTypes: repo.listCourseTypes(),
    locations: repo.listLocations(),
    templates: repo.listTemplates(),
    classSessions: repo.listClassSessions()
  };
}

export function loadTemplatesData() {
  return {
    templates: repo.listTemplates(),
    settings: getSettings()
  };
}

export function loadCampaignsData() {
  return {
    contacts: repo.listContacts(),
    classSessions: repo.listClassSessions(),
    locations: repo.listLocations(),
    templates: repo.listTemplates(),
    campaigns: repo.listCampaigns(),
    settings: getSettings()
  };
}

export function loadCommunicationsData(contactId?: string) {
  return {
    contacts: repo.listContacts(),
    communications: repo.listCommunications(),
    templates: repo.listTemplates(),
    selectedContactId: contactId ?? '',
    settings: getSettings()
  };
}

export function loadSettingsData() {
  return {
    settings: getSettings()
  };
}
