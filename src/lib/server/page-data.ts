import { repo } from './app';
import { getAppSecretStatus } from './app-secret';
import { getSettings } from './settings';

export function loadDashboardData() {
  const settings = getSettings();
  const campaigns = repo.listCampaigns();
  const retryWindow = localTodayWindow();
  return {
    stats: repo.stats(),
    campaigns,
    schedulerStatus: schedulerStatus(settings, campaigns),
    failedTodayCount: repo.countFailedCampaignDeliveriesBetween(retryWindow.startIso, retryWindow.endIso),
    remoteStatus: remoteAccessStatus(settings),
    settings
  };
}

export function localTodayWindow(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function schedulerStatus(settings: ReturnType<typeof getSettings>, campaigns: ReturnType<typeof repo.listCampaigns>) {
  const approved = campaigns.filter((campaign) => campaign.approved);
  const nextApproved = approved
    .filter((campaign) => new Date(campaign.scheduledFor).getTime() >= Date.now())
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0];
  const dueApprovedCount = approved.filter((campaign) => new Date(campaign.scheduledFor).getTime() <= Date.now()).length;
  const smtpConfigured = Boolean(settings.smtpHost && settings.smtpFrom);
  const smtpAuthConfigured = smtpAuthenticationConfigured(settings);
  const blockedReasons = [
    settings.schedulerEnabled ? '' : 'Scheduled sending is disabled',
    settings.outboundKillSwitchEnabled ? 'Outbound email is paused' : '',
    settings.emailTestModeEnabled ? 'Email test mode is redirecting outbound mail' : '',
    smtpConfigured ? '' : 'SMTP is incomplete',
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

function smtpAuthenticationConfigured(settings: ReturnType<typeof getSettings>) {
  if (settings.smtpAuthMethod === 'microsoft-oauth2') {
    return Boolean(settings.smtpUser && settings.microsoftRefreshTokenConfigured);
  }
  if (settings.smtpUser) return settings.smtpPasswordConfigured;
  return true;
}

export function remoteAccessStatus(settings: ReturnType<typeof getSettings>) {
  if (!settings.remoteAccessEnabled) {
    return { enabled: false, ready: true, blockedReasons: [] as string[] };
  }
  const appSecret = getAppSecretStatus();
  const publicBaseUrl = settings.publicBaseUrl.trim();
  const secureCookiesRequired = publicBaseUrl.toLowerCase().startsWith('https://');
  const blockedReasons = [
    publicBaseUrl ? '' : 'Set a public base URL for remote access',
    appSecret.configured ? '' : 'Configure a persistent app secret before remote access',
    secureCookiesRequired && process.env.SCUBA_EMAIL_SECURE_COOKIES !== 'true'
      ? 'Set SCUBA_EMAIL_SECURE_COOKIES=true when serving over HTTPS'
      : ''
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

export function loadCommunicationsData(input: { contactId?: string; search?: string; page?: number } = {}) {
  const limit = 25;
  const page = Math.max(input.page ?? 1, 1);
  const communicationPage = repo.listCommunicationsPage({
    contactId: input.contactId,
    search: input.search,
    limit,
    offset: (page - 1) * limit
  });
  return {
    contacts: repo.listContacts(),
    communications: communicationPage.items,
    communicationPage,
    templates: repo.listTemplates(),
    selectedContactId: input.contactId ?? '',
    settings: getSettings()
  };
}

export function loadNewEmailData(contactId?: string) {
  return {
    contacts: repo.listContacts(),
    templates: repo.listTemplates(),
    selectedContactId: contactId ?? '',
    settings: getSettings()
  };
}

export function loadSettingsData() {
  const settings = getSettings();
  return {
    settings,
    courseTypes: repo.listCourseTypes(),
    locations: repo.listLocations(),
    checklistItems: repo.listChecklistItems(),
    remoteStatus: remoteAccessStatus(settings)
  };
}
