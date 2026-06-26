import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const architecture = readFileSync('docs/ARCHITECTURE.md', 'utf8');
const maintainerGuide = readFileSync('docs/AI-MAINTAINER.md', 'utf8');
const agentDevEnv = readFileSync('docs/AGENT-DEV-ENV.md', 'utf8');

describe('operator visibility contract', () => {
  test('documents the send-state visibility requirements', () => {
    expect(architecture).toContain('## Operator Visibility Contracts');
    expect(maintainerGuide).toContain('### Operator Visibility');
    for (const phrase of [
      'Dashboard must show whether automatic scheduled sending is ready',
      'Course email schedules define automatic class emails',
      'Class detail must show both automatic course emails',
      'History must provide a complete outbound email history',
      'Test audit navigation is visible only while email test mode is enabled',
      'AI model selection should prefer model discovery'
    ]) {
      expect(architecture).toContain(phrase);
    }
    for (const phrase of [
      'due approved campaign count',
      'next approved send',
      'Approve and schedule the campaign',
      'Campaign detail must',
      'Communications must',
      'approve campaigns',
      'manual send-due control'
    ]) {
      expect(architecture).not.toContain(phrase);
      expect(maintainerGuide).not.toContain(phrase);
      expect(agentDevEnv).not.toContain(phrase);
    }
    expect(agentDevEnv).toContain('next scheduled send');
    expect(agentDevEnv).toContain('automatic course emails');
  });

  test('keeps implementation hooks for documented visibility requirements', () => {
    expect(readFileSync('src/lib/server/page-data.ts', 'utf8')).toContain('schedulerStatus');
    expect(readFileSync('src/lib/server/class-default-campaigns.ts', 'utf8')).toContain('syncDefaultCampaignsForCourseType');
    expect(readFileSync('src/routes/classes/[id]/+page.server.ts', 'utf8')).toContain('scheduledCampaigns');
    expect(readFileSync('src/routes/classes/[id]/+page.server.ts', 'utf8')).toContain('scheduledCampaignsPage = repo.listCampaignsForClassSession');
    expect(readFileSync('src/routes/settings/+page.server.ts', 'utf8')).toContain('createChecklistItem');
    expect(readFileSync('src/routes/classes/[id]/+page.server.ts', 'utf8')).toContain(
      'checklistState: repo.listEnrollmentChecklistState(params.id, detail.roster.map'
    );
    expect(readFileSync('src/routes/classes/[id]/+page.server.ts', 'utf8')).toContain('toggleChecklistItem');
    expect(readFileSync('src/lib/server/page-data.ts', 'utf8')).toContain('communicationPage = repo.listCommunicationsPage');
    expect(readFileSync('src/lib/shared/navigation.ts', 'utf8')).toContain('emailTestModeEnabled');
    expect(readFileSync('src/lib/server/llm.ts', 'utf8')).toContain('listAiModels');
  });

  test('keeps risky send actions and approval language off the dashboard', () => {
    const dashboard = readFileSync('src/routes/+page.svelte', 'utf8');
    const dashboardServer = readFileSync('src/routes/+page.server.ts', 'utf8');
    const pageData = readFileSync('src/lib/server/page-data.ts', 'utf8');
    expect(dashboard).not.toContain('resendFailedToday');
    expect(dashboardServer).not.toContain('resendFailedToday');
    expect(dashboard).not.toContain('Resend failed today');
    expect(dashboard).not.toContain('approved due now');
    expect(dashboard).not.toContain('No upcoming approved sends');
    expect(dashboard).not.toContain('failed today');
    expect(dashboard).not.toContain('ready to send now');
    expect(dashboard).not.toContain('<p>Ready to send</p>');
    expect(dashboard).toContain('<p>Prepared scheduled emails</p>');
    expect(dashboard).toContain('<a href="/campaigns"><span>{data.stats.campaigns}</span><p>Prepared scheduled emails</p></a>');
    expect(dashboard).not.toContain('<a href="/campaigns"><span>{data.stats.pendingDeliveries}</span><p>Prepared scheduled emails</p></a>');
    expect(dashboard).not.toContain('<p>Recipient emails prepared</p>');
    expect(dashboard).not.toContain('<div class="status-row">');
    expect(dashboard).not.toContain('>Campaigns<');
    expect(dashboard).not.toContain('Manage campaigns');
    expect(dashboard).not.toContain("'Approved'");
    expect(dashboard).toContain('Attention needed');
    expect(dashboard).toContain('Scheduled sending');
    expect(dashboard).toContain('data.schedulerStatus.dueReadyCount');
    expect(dashboard).toContain('data.schedulerStatus.nextReady');
    expect(dashboard).toContain('ready scheduled email');
    expect(dashboard).toContain('Next scheduled send');
    expect(dashboard).toContain('Scheduled Emails');
    expect(dashboard).toContain('Fix failed emails');
    expect(dashboard).toContain('need attention before retrying');
    expect(dashboard).not.toContain('Review failed emails');
    expect(dashboard).not.toContain('need review before retrying');
    expect(dashboard).toContain('email issue');
    expect(dashboard).toContain('data.recentScheduledEmails');
    expect(dashboard).toContain('href={`/campaigns/${campaign.id}`}');
    expect(dashboard).toContain('scheduledEmailStatusLabel(campaign.readyToSend)');
    expect(dashboard).toContain('class:good={campaign.readyToSend}');
    expect(dashboard).not.toContain('campaign.approved');
    expect(dashboard).not.toContain("campaign.approved ? 'Scheduled' : 'Draft'");
    expect(pageData).toContain('recentScheduledEmails');
    expect(pageData).toContain('countReadyScheduledEmailsDue');
    expect(pageData).toContain('getNextReadyScheduledEmail');
    expect(pageData).not.toContain('const campaigns = repo.listCampaigns()');
  });

  test('keeps contact detail focused on recent email activity with a filtered History link', () => {
    const contacts = readFileSync('src/routes/contacts/+page.svelte', 'utf8');
    const contactsServer = readFileSync('src/routes/contacts/+page.server.ts', 'utf8');
    const pageData = readFileSync('src/lib/server/page-data.ts', 'utf8');
    expect(contacts).not.toContain('Reusable student contacts');
    expect(contacts).not.toContain('<p class="eyebrow">People</p>');
    expect(contacts).toContain('<p class="eyebrow">Contacts</p>');
    expect(contacts).toContain('<h2>Students and email recipients</h2>');
    expect(contacts).toContain('Recent emails');
    expect(contacts).toContain('href={`/classes/${item.classSessionId}`}');
    expect(contacts).toContain('View all in History');
    expect(contacts).toContain('/communications?contactId=');
    expect(contacts).toContain('contactHistoryHref');
    expect(contacts).toContain('returnTo=${encodeURIComponent(contactHistoryHref)}');
    expect(contacts).toContain('href={`/communications/${communication.id}?returnTo=${encodeURIComponent(contactHistoryHref)}`}');
    expect(contacts).toContain("communication.source === 'campaign' ? 'Scheduled email' : 'Direct email'");
    expect(contacts).toContain('Needs reply');
    expect(contacts).not.toContain('communication.unreviewedReplyCount} new');
    expect(contacts).not.toContain('· {communication.source}');
    expect(contacts).not.toContain('Email activity');
    expect(contacts).not.toContain('Select a student to view class history and recent emails.');
    expect(contacts).toContain('Search contacts');
    expect(contacts).toContain('contactsPageHref');
    expect(contacts).toContain('Page {currentContactsPage} of {totalContactsPages}');
    expect(contacts.indexOf('<div class="list">')).toBeLessThan(contacts.indexOf('<div class="form-stack task-stack">'));
    expect(contacts).not.toContain('<section class="band two-column">');
    expect(contactsServer).toContain('page: Number(url.searchParams.get');
    expect(pageData).toContain('contactsPage = repo.listContactsPage');
  });

  test('keeps Classes focused on selecting scheduled classes, not setup data', () => {
    const classes = readFileSync('src/routes/classes/+page.svelte', 'utf8');
    const classesServer = readFileSync('src/routes/classes/+page.server.ts', 'utf8');
    const pageData = readFileSync('src/lib/server/page-data.ts', 'utf8');
    expect(classes).toContain('<h2>Scheduled classes</h2>');
    expect(classes).toContain('Open class');
    expect(classes).toContain('href={`/classes/${session.id}`}');
    expect(classes).not.toContain('Course types and scheduled classes');
    expect(classes).not.toContain('Class management views');
    expect(classes).not.toContain('Checklist defaults');
    expect(classes).not.toContain('Add course type');
    expect(classes).not.toContain('Enroll student');
    expect(classes).not.toContain('Manage class setup');
    expect(classes).not.toContain('defaults.');
    expect(classes).not.toContain('<h3>Class details</h3>');
    expect(classes).not.toContain('Select a class to manage its roster, requirements, and scheduled emails.');
    expect(classesServer).not.toContain('checklistItems: repo.listChecklistItems()');
    expect(classesServer).not.toContain('selectedCourseDefaults');
    expect(classesServer).not.toContain('createCourse:');
    expect(classesServer).not.toContain('createLocation:');
    expect(classesServer).not.toContain('saveCourseDefaults:');
    expect(classes).toContain('Manage courses, locations, and prep tasks');
    expect(classes).toContain('addLabel="Add course"');
    expect(classes).toContain('addLabel="Add location"');
    expect(classes).toContain('Search classes');
    expect(classes).toContain('classesPageHref');
    expect(classes).toContain('Page {currentClassesPage} of {totalClassesPages}');
    expect(classes).not.toContain('<section class="band two-column">');
    expect(classesServer).toContain('page: Number(url.searchParams.get');
    expect(pageData).toContain('classSessionsPage = repo.listClassSessionsPage');
  });

  test('makes class detail roster prep understandable without checklist jargon', () => {
    const classDetail = readFileSync('src/routes/classes/[id]/+page.svelte', 'utf8');
    const classDetailServer = readFileSync('src/routes/classes/[id]/+page.server.ts', 'utf8');

    expect(classDetail).toContain('Roster and prep');
    expect(classDetail).toContain('Search students');
    expect(classDetail).toContain('data.rosterPage.total');
    expect(classDetail).toContain('rosterPageHref');
    expect(classDetail).toContain('Prep items');
    expect(classDetail).toContain('student-prep-items');
    expect(classDetail).toContain('<h3>Import CSV roster</h3>');
    expect(classDetail).toContain('<h3>Import roster photo</h3>');
    expect(classDetail).not.toContain('<summary>Import CSV roster</summary>');
    expect(classDetail).not.toContain('<summary>Import roster photo</summary>');
    expect(classDetailServer).toContain('Prep item updated.');
    expect(classDetailServer).toContain('detail.roster.map((contact) => contact.id)');
    expect(classDetailServer).toContain('repo.listEnrollmentChecklistState(params.id, detail.roster.map');
    expect(classDetailServer).not.toContain('Checklist updated.');
    expect(classDetail).not.toContain('<section class="band two-column">');
  });

  test('keeps class email as a visible primary action instead of a one-item collapse', () => {
    const classDetail = readFileSync('src/routes/classes/[id]/+page.svelte', 'utf8');

    expect(classDetail).toContain('<h3>Email this class</h3>');
    expect(classDetail).toContain('Preview student emails');
    expect(classDetail).not.toContain('<summary>Email this class</summary>');
  });

  test('names inherited class emails without default or class-type jargon', () => {
    const classDetail = readFileSync('src/routes/classes/[id]/+page.svelte', 'utf8');
    const classesServer = readFileSync('src/routes/classes/+page.server.ts', 'utf8');
    const classDetailServer = readFileSync('src/routes/classes/[id]/+page.server.ts', 'utf8');

    expect(classDetail).toContain('Automatic class emails');
    expect(classDetail).toContain('Emails added from course');
    expect(classDetail).toContain('From course');
    expect(classDetail).not.toContain('Course email defaults');
    expect(classDetail).not.toContain('Automatic schedules from this class type');
    expect(classDetail).not.toContain('Inherited from course type');
    expect(classDetail).not.toContain('<span class="pill">Default</span>');
    expect(classDetail).not.toContain('course setup');
    expect(classDetail).not.toContain('setup emails');
    expect(classesServer).toContain('course email');
    expect(classesServer).not.toContain('Course email defaults updated.');
    expect(classesServer).not.toContain('default email');
    expect(classDetailServer).toContain('Class updated. Scheduled');
    expect(classDetailServer).toContain('course email');
    expect(classDetailServer).not.toContain('default email');
  });

  test('gives setup data a Settings App Data home', () => {
    const settings = readFileSync('src/routes/settings/+page.svelte', 'utf8');
    const settingsServer = readFileSync('src/routes/settings/+page.server.ts', 'utf8');
    const classesServer = readFileSync('src/routes/classes/+page.server.ts', 'utf8');
    expect(settings).toContain('<summary>App Data</summary>');
    expect(settings).toContain('<p class="eyebrow">App data</p>');
    expect(settings).toContain('Course types');
    expect(settings).toContain('Locations');
    expect(settings).toContain('Prep tasks');
    expect(settings).toContain('Search app data');
    expect(settings).toContain('appDataPageHref');
    expect(settings).toContain('Page {currentAppDataPage} of {totalAppDataPages}');
    expect(settings).not.toContain('Reusable setup');
    expect(settings).not.toContain('Class prep defaults');
    expect(settings).not.toContain('No class prep defaults yet.');
    expect(settings).toContain('?/createCourse');
    expect(settings).toContain('?/createLocation');
    expect(settings).toContain('?/createChecklistItem');
    expect(settingsServer).toContain("appDataSearch: url.searchParams.get('appDataSearch') ?? ''");
    expect(settings).toContain('name="section" value="app-data"');
    expect(settingsServer).toContain("appDataPage: Number(url.searchParams.get('appDataPage') ?? '1')");
    expect(readFileSync('src/lib/server/page-data.ts', 'utf8')).toContain('courseTypesPage = repo.listCourseTypesPage');
    expect(readFileSync('src/lib/server/page-data.ts', 'utf8')).toContain('locationsPage = repo.listLocationsPage');
    expect(readFileSync('src/lib/server/page-data.ts', 'utf8')).toContain('checklistItemsPage = repo.listChecklistItemsPage');
    expect(settingsServer).toContain('Prep task added.');
    expect(settingsServer).toContain('Prep task updated.');
    expect(settingsServer).toContain('Prep task deleted.');
    expect(settingsServer).not.toContain('Checklist item added.');
    expect(settingsServer).not.toContain('Checklist item updated.');
    expect(settingsServer).not.toContain('Checklist item deleted.');
    expect(classesServer).not.toContain('Prep task added.');
    expect(classesServer).not.toContain('Prep task updated.');
    expect(classesServer).not.toContain('Prep task deleted.');
  });

  test('uses plain scheduled-email language instead of approval campaign copy', () => {
    const scheduledEmails = readFileSync('src/routes/campaigns/+page.svelte', 'utf8');
    const scheduledEmailsServer = readFileSync('src/routes/campaigns/+page.server.ts', 'utf8');
    const scheduledEmailDetailServer = readFileSync('src/routes/campaigns/[id]/+page.server.ts', 'utf8');
    const pageData = readFileSync('src/lib/server/page-data.ts', 'utf8');
    const scheduledEmailDetail = readFileSync('src/routes/campaigns/[id]/+page.svelte', 'utf8');
    const classDetail = readFileSync('src/routes/classes/[id]/+page.svelte', 'utf8');
    const settings = readFileSync('src/routes/settings/+page.svelte', 'utf8');

    for (const source of [scheduledEmails, scheduledEmailDetail, classDetail, settings]) {
      expect(source).not.toContain('Approved');
      expect(source).not.toContain('approved campaigns');
      expect(source).not.toContain('approved scheduled campaigns');
    }
    expect(settings).toContain('Let agents schedule confirmed emails');
    expect(settings).toContain('Let agents prepare emails for my confirmation');
    expect(settings).not.toContain('Let agents prepare emails for my review');
    expect(settings).not.toContain('Let agents schedule reviewed emails');
    expect(scheduledEmailDetail).not.toContain('Campaign detail');
    expect(scheduledEmailDetail).not.toContain('· Campaign');
    expect(scheduledEmailDetail).not.toContain('<div class="status-row">');
    expect(scheduledEmailDetail).toContain('<dl class="detail-facts">');
    expect(scheduledEmailDetail).toContain('<dt>Status</dt>');
    expect(scheduledEmailDetail).toContain('<dt>Class</dt>');
    expect(scheduledEmailDetail).toContain('<dt>Template</dt>');
    expect(scheduledEmailDetail).toContain('<dt>Send time</dt>');
    expect(scheduledEmailDetail).toContain('Scheduled email detail');
    expect(scheduledEmailDetail).toContain('View in History');
    expect(scheduledEmailDetail).toContain('/communications?sourceId=');
    expect(scheduledEmailDetail).toContain('Ready to send');
    expect(scheduledEmails).toContain('scheduledEmailStatusLabel(campaign.readyToSend)');
    expect(scheduledEmails).toContain('class:good={campaign.readyToSend}');
    expect(scheduledEmails).toContain('scheduledEmailDeliverySummary(campaign)');
    expect(scheduledEmailDetail).toContain('scheduledEmailStatusLabel(data.campaign.readyToSend)');
    expect(scheduledEmailDetail).toContain('class:good={data.campaign.readyToSend}');
    expect(classDetail).toContain('scheduledEmailStatusLabel(campaign.readyToSend)');
    expect(classDetail).toContain('class:good={campaign.readyToSend}');
    expect(scheduledEmails).not.toContain('campaign.approved');
    expect(scheduledEmailDetail).not.toContain('data.campaign.approved');
    expect(classDetail).not.toContain('campaign.approved');
    expect(scheduledEmails).not.toContain("campaign.approved ? 'Scheduled' : 'Draft'");
    expect(scheduledEmailDetail).not.toContain("data.campaign.approved ? 'Ready to send' : 'Draft'");
    expect(classDetail).not.toContain("campaign.approved ? 'Ready to send' : 'Draft'");
    expect(scheduledEmailDetail).not.toContain('name="approved"');
    expect(scheduledEmailDetail).toContain('<h3>Edit schedule</h3>');
    expect(scheduledEmailDetail).toContain('<h3>Template snapshot</h3>');
    expect(scheduledEmailDetail).toContain('Delete scheduled email');
    expect(scheduledEmailDetail).not.toContain('Delete draft');
    expect(scheduledEmailDetail).not.toContain('<h3>Lifecycle</h3>');
    expect(scheduledEmailDetail).not.toContain('<section class="band two-column">');
    expect(scheduledEmailDetail).not.toContain('<summary>Template snapshot</summary>');
    expect(scheduledEmailDetail).not.toContain('preview-backed scheduling flow');
    expect(scheduledEmailDetail).toContain('Draft emails need a student preview before they can be marked ready.');
    expect(scheduledEmailsServer).toContain("scheduleMode === 'ready'");
    expect(scheduledEmailsServer).not.toContain("form.get('approved') === 'on'");
    expect(scheduledEmails).toContain('Search scheduled emails');
    expect(scheduledEmails).toContain('Filter scheduled emails');
    expect(scheduledEmails).toContain('statusFilters');
    expect(scheduledEmails).toContain('statusFilterHref');
    expect(scheduledEmails).toContain('aria-label="Filter scheduled emails"');
    expect(scheduledEmails).not.toContain('<select name="status"');
    expect(scheduledEmails).toContain('Upcoming');
    expect(scheduledEmails).toContain('Sent');
    expect(scheduledEmails).toContain('Needs attention');
    expect(scheduledEmails).not.toContain("label: 'Needs review'");
    expect(scheduledEmails).toContain('data.campaignsPage.status');
    expect(scheduledEmails).toContain('campaignsPageHref');
    expect(scheduledEmails).toContain('Page {currentCampaignsPage} of {totalCampaignsPages}');
    expect(scheduledEmails.indexOf('<div class="list">')).toBeLessThan(scheduledEmails.indexOf('<div class="form-stack">'));
    expect(scheduledEmails).not.toContain('<section class="band two-column">');
    expect(scheduledEmailDetail).toContain('Search recipients');
    expect(scheduledEmailDetail).toContain('data.recipientPage.total');
    expect(scheduledEmailDetail).toContain('recipientPageHref');
    expect(scheduledEmailsServer).toContain('page: Number(url.searchParams.get');
    expect(scheduledEmailsServer).toContain("status: url.searchParams.get('status') ?? ''");
    expect(pageData).toContain('campaignsPage = repo.listCampaignsPage');
    expect(scheduledEmailDetailServer).not.toContain('before approving');
    expect(scheduledEmailDetailServer).not.toContain('approving this campaign');
    expect(scheduledEmailDetailServer).not.toContain("form.get('approved') === 'on'");
    expect(scheduledEmailDetailServer).toContain("form.get('scheduleMode') === 'ready'");
    expect(scheduledEmailDetailServer).not.toContain('Campaign updated.');
    expect(scheduledEmailDetailServer).toContain('Scheduled email updated.');
    expect(scheduledEmailsServer).not.toContain('Campaign schedule created.');
    expect(scheduledEmailsServer).toContain('Scheduled email created.');
    expect(settings).not.toContain('Blocks campaign sends');
    expect(settings).toContain('Blocks scheduled emails, direct email, SMTP tests, and test-mode reroutes until turned off.');
  });

  test('keeps global send-due actions out of scheduled email detail', () => {
    const scheduledEmailDetail = readFileSync('src/routes/campaigns/[id]/+page.svelte', 'utf8');
    const scheduledEmailDetailServer = readFileSync('src/routes/campaigns/[id]/+page.server.ts', 'utf8');

    expect(scheduledEmailDetail).not.toContain('Send due now');
    expect(scheduledEmailDetail).not.toContain('?/sendDueNow');
    expect(scheduledEmailDetailServer).not.toContain('sendDueNow');
    expect(scheduledEmailDetailServer).not.toContain('manual_send_due');
    expect(scheduledEmailDetail).toContain('retryableRecipientCount');
    expect(scheduledEmailDetail).toContain('{#if retryableRecipientCount}');
    expect(scheduledEmailDetail).toContain('No failed recipients to retry.');
  });

  test('formats technical delivery statuses before showing them to instructors', () => {
    const scheduledEmailDetail = readFileSync('src/routes/campaigns/[id]/+page.svelte', 'utf8');
    const history = readFileSync('src/routes/communications/+page.svelte', 'utf8');
    const contacts = readFileSync('src/routes/contacts/+page.svelte', 'utf8');
    const classDetail = readFileSync('src/routes/classes/[id]/+page.svelte', 'utf8');

    expect(scheduledEmailDetail).toContain('deliveryStatusLabel(recipient.status)');
    expect(history).toContain('messageStatusLabel(communication.status)');
    expect(contacts).toContain('messageStatusLabel(communication.status)');
    expect(classDetail).toContain('scheduledEmailDeliverySummary(campaign)');
    expect(classDetail).toContain('Search scheduled emails');
    expect(classDetail).toContain('data.scheduledCampaignsPage.total');
    expect(classDetail).toContain('classEmailsPageHref');
    expect(classDetail).toContain('Page {currentClassEmailsPage} of {totalClassEmailsPages}');
    expect(scheduledEmailDetail).not.toContain('{recipient.status}</span>');
    expect(history).not.toContain('{communication.status}</span>');
    expect(contacts).not.toContain('{communication.status}</span>');
    expect(classDetail).not.toContain('{campaign.pendingCount} pending');
    expect(classDetail).not.toContain('{campaign.failedCount} failed');
  });

  test('keeps Test Sends paginated and searchable', () => {
    const testSends = readFileSync('src/routes/test-audit/+page.svelte', 'utf8');
    const testSendsServer = readFileSync('src/routes/test-audit/+page.server.ts', 'utf8');
    const repository = readFileSync('src/lib/server/repository/communications.ts', 'utf8');

    expect(testSendsServer).toContain('listEmailTestAuditsPage');
    expect(testSends).toContain('Search test sends');
    expect(testSends).toContain("<p class=\"eyebrow\">Test Sends</p>");
    expect(testSends).toContain('Redirected test emails');
    expect(testSends).toContain('testAuditPageHref');
    expect(testSends).toContain('Page {currentTestAuditPage} of {totalTestAuditPages}');
    expect(testSends).not.toContain('Historical audit');
    expect(testSends).not.toContain('Redirected email audit');
    expect(repository).toContain('limit ? offset ?');
  });

  test('keeps Templates paginated and searchable', () => {
    const templates = readFileSync('src/routes/templates/+page.svelte', 'utf8');
    const templatesServer = readFileSync('src/routes/templates/+page.server.ts', 'utf8');
    const pageData = readFileSync('src/lib/server/page-data.ts', 'utf8');
    const repository = readFileSync('src/lib/server/repository/templates.ts', 'utf8');

    expect(templates).toContain('<h2>Email templates</h2>');
    expect(templates).not.toContain('Reusable personalized emails');
    expect(templates).toContain('<h3>Edit AI draft</h3>');
    expect(templates).not.toContain('Review AI draft');
    expect(templates).toContain('Search templates');
    expect(templates).toContain('templatesPageHref');
    expect(templates).toContain('Page {currentTemplatesPage} of {totalTemplatesPages}');
    expect(templates).toContain('fields={variableFields}');
    expect(templates).not.toContain('<summary>Template fields</summary>');
    expect(templates).not.toContain('class="token-help"');
    expect(templates.indexOf('<div class="list">')).toBeLessThan(templates.indexOf('<div class="form-stack task-stack">'));
    expect(templates).not.toContain('<section class="band two-column">');
    expect(templatesServer).toContain('page: Number(url.searchParams.get');
    expect(pageData).toContain('templatesPage = repo.listTemplatesPage');
    expect(repository).toContain('limit ? offset ?');
  });

  test('lets instructors reply to imported email replies from History', () => {
    const history = readFileSync('src/routes/communications/+page.svelte', 'utf8');
    const historyDetail = readFileSync('src/routes/communications/[id]/+page.svelte', 'utf8');
    const historyServer = readFileSync('src/routes/communications/+page.server.ts', 'utf8');
    const historyDetailServer = readFileSync('src/routes/communications/[id]/+page.server.ts', 'utf8');
    const newEmail = readFileSync('src/routes/new-email/+page.svelte', 'utf8');
    const newEmailServer = readFileSync('src/routes/new-email/+page.server.ts', 'utf8');
    const pageData = readFileSync('src/lib/server/page-data.ts', 'utf8');

    expect(historyDetail).toContain('replyHref');
    expect(history).toContain('data.selectedSourceId');
    expect(history).toContain('params.set(\'sourceId\', data.selectedSourceId)');
    expect(history).toContain('data.selectedReplyStatus');
    expect(history).toContain("params.set('replyStatus', data.selectedReplyStatus)");
    expect(history).toContain('name="sourceId"');
    expect(history).toContain('Active filters');
    expect(history).toContain('Filtered to selected contact');
    expect(history).toContain('Filtered to selected scheduled email');
    expect(history).toContain('Filtered to emails needing replies');
    expect(history).toContain('aria-label="Filter email history"');
    expect(history).toContain("value: 'needs_reply', label: 'Needs reply'");
    expect(history).toContain('Clear filters');
    expect(history).toContain('historyReturnTo');
    expect(history).toContain('returnTo=${encodeURIComponent(historyReturnTo)}');
    expect(history).toContain('href={`/communications/${communication.id}?returnTo=${encodeURIComponent(historyReturnTo)}`}');
    expect(history).not.toContain('<div class="reply-list">');
    expect(history).not.toContain('{reply.snippet || reply.textBody}');
    expect(history).toContain('Reply');
    expect(history).toContain('Search sent, failed, and replied-to emails.');
    expect(history).not.toContain('compose workflow');
    expect(history).not.toContain('No reply yet');
    expect(history).not.toContain('Acknowledged');
    expect(history).not.toContain('<span class="pill good">Reviewed</span>');
    expect(history).not.toContain('new</span>');
    expect(history).toContain('Student replied');
    expect(history).toContain('Needs reply');
    expect(historyDetail).toContain('Reply handled');
    expect(historyDetail).toContain('Mark handled');
    expect(historyDetail).toContain('Reply to the student or mark replies handled.');
    expect(historyDetail).toContain('href={data.returnTo || \'/communications\'}');
    expect(historyDetail).toContain('communication.classSessionId');
    expect(historyDetail).toContain('href={`/classes/${communication.classSessionId}`}');
    expect(historyDetail).toContain('detailReturnTo');
    expect(historyDetail).toContain("params.set('returnTo', detailReturnTo)");
    expect(historyDetailServer).toContain('localReturnTo');
    expect(historyDetailServer).toContain("returnTo: localReturnTo(url.searchParams.get('returnTo') ?? '')");
    expect(historyDetail).toContain('?/markReplyHandled');
    expect(historyDetailServer).toContain('markReplyHandled');
    expect(historyServer).toContain('markReplyHandled');
    expect(historyServer).toContain("replyStatus: url.searchParams.get('replyStatus') || undefined");
    expect(historyDetail).not.toContain('Reply reviewed');
    expect(historyDetail).not.toContain('Mark reviewed');
    expect(historyDetail).not.toContain('mark replies reviewed');
    expect(historyDetail).not.toContain('markReplyReviewed');
    expect(historyDetailServer).not.toContain('markReplyReviewed');
    expect(historyServer).not.toContain('markReplyReviewed');
    expect(historyServer).toContain('Reply marked handled.');
    expect(historyDetailServer).toContain('Reply marked handled.');
    expect(historyServer).not.toContain('Reply marked reviewed.');
    expect(historyDetailServer).not.toContain('Reply marked reviewed.');
    expect(history).toContain('<h3>Email records</h3>');
    expect(history).toContain('<dl class="history-facts">');
    expect(history).toContain('<dt>Delivery</dt>');
    expect(history).toContain('<dt>Replies</dt>');
    expect(history).not.toContain('Every recorded email');
    expect(history).not.toContain('<div class="status-stack">');
    expect(historyDetail).toContain('/new-email?');
    expect(historyDetail).toContain('<div class="reply-list">');
    expect(historyDetail).toContain('{communication.body}');
    expect(newEmailServer).toContain("url.searchParams.get('subject')");
    expect(newEmailServer).toContain("url.searchParams.get('body')");
    expect(newEmailServer).toContain("url.searchParams.get('returnTo')");
    expect(newEmailServer).toContain('returnTo: localReturnTo');
    expect(newEmail).toContain('newEmailReturnTo');
    expect(newEmail).toContain('newEmailWorkflowReturnTo');
    expect(newEmail).toContain("params.set('subject', subject)");
    expect(newEmail).toContain("params.set('body', body)");
    expect(newEmail).toContain("params.set('returnTo', newEmailReturnTo)");
    expect(newEmail).toContain('href={newEmailReturnTo || \'/communications\'}');
    expect(newEmail).toContain('name="returnTo"');
    expect(newEmailServer).toContain('directEmailOperationId');
    expect(newEmailServer).toContain("throw redirect(303, `/communications?sourceId=${encodeURIComponent(sourceId)}`)");
    expect(pageData).toContain('prefillSubject');
    expect(pageData).toContain('prefillBody');
    expect(pageData).toContain('selectedReplyStatus');
    expect(newEmail).toContain('data.prefillSubject');
    expect(newEmail).toContain('data.prefillBody');
    expect(newEmail).not.toContain('<section class="band two-column">');
  });
});
