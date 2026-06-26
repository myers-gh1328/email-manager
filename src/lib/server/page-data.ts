import { repo } from './app';
import { getAppSecretStatus } from './app-secret';
import { getSettings } from './settings';

export function loadDashboardData() {
  const settings = getSettings();
  const nowIso = new Date().toISOString();
  const recentScheduledEmails = repo.listCampaignsPage({ limit: 5 }).items.map(withReadyToSend);
  const retryWindow = localTodayWindow();
  return {
    stats: repo.stats(),
    recentScheduledEmails,
    schedulerStatus: schedulerStatus(settings, {
      dueReadyCount: repo.countReadyScheduledEmailsDue(nowIso),
      nextReady: repo.getNextReadyScheduledEmail(nowIso)
    }),
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

export function schedulerStatus(
  settings: ReturnType<typeof getSettings>,
  scheduledEmails:
    | ReturnType<typeof repo.listCampaigns>
    | { dueReadyCount: number; nextReady: ReturnType<typeof repo.getNextReadyScheduledEmail> }
) {
  const scheduledEmailStatus = Array.isArray(scheduledEmails)
    ? {
        dueReadyCount: scheduledEmails.filter(
          (campaign) => campaign.approved && new Date(campaign.scheduledFor).getTime() <= Date.now()
        ).length,
        nextReady: scheduledEmails
          .filter((campaign) => campaign.approved && new Date(campaign.scheduledFor).getTime() >= Date.now())
          .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0]
      }
    : scheduledEmails;
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
    dueReadyCount: scheduledEmailStatus.dueReadyCount,
    nextReady: scheduledEmailStatus.nextReady ? withReadyToSend(scheduledEmailStatus.nextReady) : undefined
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

export function loadContactsData(input: { contactId?: string; search?: string; page?: number } = {}) {
  const limit = 25;
  const page = Math.max(input.page ?? 1, 1);
  const contactsPage = repo.listContactsPage({
    search: input.search,
    limit,
    offset: (page - 1) * limit
  });
  return {
    contacts: contactsPage.items,
    contactsPage,
    selectedContactId: input.contactId ?? '',
    contactDetail: input.contactId ? repo.getContactDetail(input.contactId) : undefined,
    settings: getSettings()
  };
}

export function loadContactOptions(selectedContactIds: string[] = []) {
  const options = repo.listContactsPage({ limit: 25 }).items;
  const byId = new Map(options.map((contact) => [contact.id, contact]));
  for (const contactId of selectedContactIds.filter(Boolean)) {
    if (!byId.has(contactId)) {
      const contact = repo.getContact(contactId);
      byId.set(contact.id, contact);
    }
  }
  return [...byId.values()];
}

export function formatClassSessionOption(session: ReturnType<typeof repo.listClassSessionsPage>['items'][number]) {
  const endsOn = session.endsOn || session.startsOn;
  const dateRange = endsOn !== session.startsOn ? `${session.startsOn} - ${endsOn}` : session.startsOn;
  const schedule = session.startTime ? `${dateRange} · ${session.startTime}` : dateRange;
  return { value: session.id, label: `${session.courseName} · ${schedule}` };
}

export function formatTemplateOption(template: ReturnType<typeof repo.listTemplatesPage>['items'][number]) {
  return { value: template.id, label: template.name };
}

export function formatCourseTypeOption(course: ReturnType<typeof repo.listCourseTypesPage>['items'][number]) {
  return { value: course.id, label: course.name };
}

export function formatLocationOption(location: ReturnType<typeof repo.listLocationsPage>['items'][number]) {
  return { value: location.id, label: location.name };
}

export function loadClassSessionOptions() {
  return repo.listClassSessionsPage({ limit: 25 }).items.map(formatClassSessionOption);
}

export function loadTemplateOptions() {
  return repo.listTemplatesPage({ limit: 25 }).items.map(formatTemplateOption);
}

export function loadCourseTypeOptions(selectedCourseTypeIds: string[] = []) {
  const options = repo.listCourseTypesPage({ limit: 25 }).items;
  const byId = new Map(options.map((course) => [course.id, course]));
  for (const courseTypeId of selectedCourseTypeIds.filter(Boolean)) {
    if (!byId.has(courseTypeId)) {
      const course = repo.getCourseType(courseTypeId);
      byId.set(course.id, course);
    }
  }
  return [...byId.values()];
}

export function loadLocationOptions(selectedLocationIds: string[] = []) {
  const options = repo.listLocationsPage({ limit: 25 }).items;
  const byId = new Map(options.map((location) => [location.id, location]));
  for (const locationId of selectedLocationIds.filter(Boolean)) {
    if (!byId.has(locationId)) {
      const location = repo.getLocation(locationId);
      byId.set(location.id, location);
    }
  }
  return [...byId.values()];
}

export function loadClassesData(input: { search?: string; page?: number } = {}) {
  const limit = 25;
  const page = Math.max(input.page ?? 1, 1);
  const classSessionsPage = repo.listClassSessionsPage({
    search: input.search,
    limit,
    offset: (page - 1) * limit
  });
  return {
    courseTypes: loadCourseTypeOptions(),
    locations: loadLocationOptions(),
    classSessions: classSessionsPage.items,
    classSessionsPage
  };
}

export function loadTemplatesData(input: { search?: string; page?: number } = {}) {
  const limit = 25;
  const page = Math.max(input.page ?? 1, 1);
  const templatesPage = repo.listTemplatesPage({
    search: input.search,
    limit,
    offset: (page - 1) * limit
  });
  return {
    templates: templatesPage.items,
    templatesPage,
    settings: getSettings()
  };
}

export function loadCampaignsData(input: { search?: string; page?: number; status?: string } = {}) {
  const limit = 25;
  const page = Math.max(input.page ?? 1, 1);
  const campaignsPage = repo.listCampaignsPage({
    search: input.search,
    status: input.status,
    limit,
    offset: (page - 1) * limit
  });
  return {
    classSessionOptions: loadClassSessionOptions(),
    templateOptions: loadTemplateOptions(),
    campaigns: campaignsPage.items.map(withReadyToSend),
    campaignsPage: withVisibleScheduledEmailsPage(campaignsPage),
    settings: getSettings()
  };
}

function withVisibleScheduledEmailsPage<T extends { items: Array<{ approved: boolean }> }>(campaignsPage: T) {
  return {
    ...campaignsPage,
    items: campaignsPage.items.map(withReadyToSend)
  };
}

export function withReadyToSend<T extends { approved: boolean }>(campaign: T) {
  const { approved, ...visibleCampaign } = campaign;
  return {
    ...visibleCampaign,
    readyToSend: approved
  };
}

export function loadCommunicationsData(input: { contactId?: string; sourceId?: string; replyStatus?: string; status?: string; type?: string; search?: string; page?: number } = {}) {
  const limit = 25;
  const page = Math.max(input.page ?? 1, 1);
  const communicationPage = repo.listCommunicationsPage({
    contactId: input.contactId,
    sourceId: input.sourceId,
    replyStatus: input.replyStatus,
    status: input.status,
    type: input.type,
    search: input.search,
    limit,
    offset: (page - 1) * limit
  });
  return {
    communications: communicationPage.items,
    communicationPage,
    selectedContactId: input.contactId ?? '',
    selectedSourceId: input.sourceId ?? '',
    selectedReplyStatus: input.replyStatus ?? '',
    selectedStatus: input.status ?? '',
    selectedType: input.type ?? '',
    settings: getSettings()
  };
}

export function loadNewEmailData(input: { contactId?: string; subject?: string; body?: string; returnTo?: string } = {}) {
  return {
    contactOptions: loadContactOptions(input.contactId ? [input.contactId] : []),
    templateOptions: loadTemplateOptions(),
    selectedContactId: input.contactId ?? '',
    prefillSubject: input.subject ?? '',
    prefillBody: input.body ?? '',
    returnTo: input.returnTo ?? '',
    settings: getSettings()
  };
}

export function loadSettingsData(input: { appDataSearch?: string; appDataPage?: number } = {}) {
  const settings = getSettings();
  const limit = 10;
  const appDataPage = Math.max(input.appDataPage ?? 1, 1);
  const appDataSearch = input.appDataSearch ?? '';
  const appDataPageInput = {
    search: appDataSearch,
    limit,
    offset: (appDataPage - 1) * limit
  };
  const courseTypesPage = repo.listCourseTypesPage(appDataPageInput);
  const locationsPage = repo.listLocationsPage(appDataPageInput);
  const checklistItemsPage = repo.listChecklistItemsPage(appDataPageInput);
  return {
    settings,
    courseTypes: courseTypesPage.items,
    locations: locationsPage.items,
    checklistItems: checklistItemsPage.items,
    courseTypesPage,
    locationsPage,
    checklistItemsPage,
    remoteStatus: remoteAccessStatus(settings)
  };
}
