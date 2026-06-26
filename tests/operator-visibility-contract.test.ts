import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const architecture = readFileSync('docs/ARCHITECTURE.md', 'utf8');
const maintainerGuide = readFileSync('docs/AI-MAINTAINER.md', 'utf8');

describe('operator visibility contract', () => {
  test('documents the send-state visibility requirements', () => {
    expect(architecture).toContain('## Operator Visibility Contracts');
    expect(maintainerGuide).toContain('### Operator Visibility');
    for (const phrase of [
      'Dashboard must show whether automatic scheduled sending is ready',
      'Course type email defaults define automatic schedules',
      'Class detail must show both course-type email defaults',
      'Communications must provide a complete outbound email history',
      'Test audit navigation is visible only while email test mode is enabled',
      'AI model selection should prefer model discovery'
    ]) {
      expect(architecture).toContain(phrase);
    }
  });

  test('keeps implementation hooks for documented visibility requirements', () => {
    expect(readFileSync('src/lib/server/page-data.ts', 'utf8')).toContain('schedulerStatus');
    expect(readFileSync('src/lib/server/class-default-campaigns.ts', 'utf8')).toContain('syncDefaultCampaignsForCourseType');
    expect(readFileSync('src/routes/classes/[id]/+page.server.ts', 'utf8')).toContain('scheduledCampaigns');
    expect(readFileSync('src/routes/classes/+page.server.ts', 'utf8')).toContain('checklistItems: repo.listChecklistItems()');
    expect(readFileSync('src/routes/classes/[id]/+page.server.ts', 'utf8')).toContain(
      'checklistState: repo.listEnrollmentChecklistState(params.id)'
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
    expect(dashboard).toContain('<p>Recipient emails prepared</p>');
    expect(dashboard).not.toContain('<div class="status-row">');
    expect(dashboard).not.toContain('>Campaigns<');
    expect(dashboard).not.toContain('Manage campaigns');
    expect(dashboard).not.toContain("'Approved'");
    expect(dashboard).toContain('Attention needed');
    expect(dashboard).toContain('Scheduled Emails');
    expect(dashboard).toContain('Review failed emails');
    expect(dashboard).toContain('email issue');
    expect(dashboard).toContain('data.recentScheduledEmails');
    expect(dashboard).toContain('href={`/campaigns/${campaign.id}`}');
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
    expect(contacts).toContain('View all in History');
    expect(contacts).toContain('/communications?contactId=');
    expect(contacts).not.toContain('Email activity');
    expect(contacts).toContain('Search contacts');
    expect(contacts).toContain('contactsPageHref');
    expect(contacts).toContain('Page {currentContactsPage} of {totalContactsPages}');
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
    expect(classes).toContain('Manage courses, locations, and prep tasks');
    expect(classes).toContain('addLabel="Add course"');
    expect(classes).toContain('addLabel="Add location"');
    expect(classes).toContain('Search classes');
    expect(classes).toContain('classesPageHref');
    expect(classes).toContain('Page {currentClassesPage} of {totalClassesPages}');
    expect(classesServer).toContain('page: Number(url.searchParams.get');
    expect(pageData).toContain('classSessionsPage = repo.listClassSessionsPage');
  });

  test('makes class detail roster prep understandable without checklist jargon', () => {
    const classDetail = readFileSync('src/routes/classes/[id]/+page.svelte', 'utf8');
    const classDetailServer = readFileSync('src/routes/classes/[id]/+page.server.ts', 'utf8');

    expect(classDetail).toContain('Roster and prep');
    expect(classDetail).toContain('Prep items');
    expect(classDetail).toContain('student-prep-items');
    expect(classDetail).toContain('<h3>Import CSV roster</h3>');
    expect(classDetail).toContain('<h3>Import roster photo</h3>');
    expect(classDetail).not.toContain('<summary>Import CSV roster</summary>');
    expect(classDetail).not.toContain('<summary>Import roster photo</summary>');
    expect(classDetailServer).toContain('Prep item updated.');
    expect(classDetailServer).not.toContain('Checklist updated.');
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

    expect(classDetail).toContain('Course scheduled emails');
    expect(classDetail).toContain('Emails added from course setup');
    expect(classDetail).toContain('From course setup');
    expect(classDetail).not.toContain('Course email defaults');
    expect(classDetail).not.toContain('Automatic schedules from this class type');
    expect(classDetail).not.toContain('Inherited from course type');
    expect(classDetail).not.toContain('<span class="pill">Default</span>');
    expect(classesServer).toContain('Course setup emails updated.');
    expect(classesServer).toContain('setup email');
    expect(classesServer).not.toContain('Course email defaults updated.');
    expect(classesServer).not.toContain('default email');
    expect(classDetailServer).toContain('setup email');
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
    expect(settings).not.toContain('Reusable setup');
    expect(settings).not.toContain('Class prep defaults');
    expect(settings).not.toContain('No class prep defaults yet.');
    expect(settings).toContain('?/createCourse');
    expect(settings).toContain('?/createLocation');
    expect(settings).toContain('?/createChecklistItem');
    for (const source of [settingsServer, classesServer]) {
      expect(source).toContain('Prep task added.');
      expect(source).toContain('Prep task updated.');
      expect(source).toContain('Prep task deleted.');
      expect(source).not.toContain('Checklist item added.');
      expect(source).not.toContain('Checklist item updated.');
      expect(source).not.toContain('Checklist item deleted.');
    }
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
    expect(scheduledEmailDetail).not.toContain('Campaign detail');
    expect(scheduledEmailDetail).not.toContain('· Campaign');
    expect(scheduledEmailDetail).not.toContain('<div class="status-row">');
    expect(scheduledEmailDetail).toContain('<dl class="detail-facts">');
    expect(scheduledEmailDetail).toContain('<dt>Status</dt>');
    expect(scheduledEmailDetail).toContain('<dt>Class</dt>');
    expect(scheduledEmailDetail).toContain('<dt>Template</dt>');
    expect(scheduledEmailDetail).toContain('<dt>Send time</dt>');
    expect(scheduledEmailDetail).toContain('Scheduled email detail');
    expect(scheduledEmailDetail).toContain('Ready to send');
    expect(scheduledEmailDetail).toContain('<h3>Edit schedule</h3>');
    expect(scheduledEmailDetail).toContain('<h3>Template snapshot</h3>');
    expect(scheduledEmailDetail).not.toContain('<h3>Lifecycle</h3>');
    expect(scheduledEmailDetail).not.toContain('<summary>Template snapshot</summary>');
    expect(scheduledEmailDetail).not.toContain('preview-backed scheduling flow');
    expect(scheduledEmailDetail).toContain('Draft emails need a student preview before they can be marked ready.');
    expect(scheduledEmailsServer).toContain("scheduleMode === 'ready'");
    expect(scheduledEmailsServer).not.toContain("form.get('approved') === 'on'");
    expect(scheduledEmails).toContain('Search scheduled emails');
    expect(scheduledEmails).toContain('campaignsPageHref');
    expect(scheduledEmails).toContain('Page {currentCampaignsPage} of {totalCampaignsPages}');
    expect(scheduledEmailsServer).toContain('page: Number(url.searchParams.get');
    expect(pageData).toContain('campaignsPage = repo.listCampaignsPage');
    expect(scheduledEmailDetailServer).not.toContain('before approving');
    expect(scheduledEmailDetailServer).not.toContain('approving this campaign');
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
    expect(testSends).toContain('testAuditPageHref');
    expect(testSends).toContain('Page {currentTestAuditPage} of {totalTestAuditPages}');
    expect(repository).toContain('limit ? offset ?');
  });

  test('keeps Templates paginated and searchable', () => {
    const templates = readFileSync('src/routes/templates/+page.svelte', 'utf8');
    const templatesServer = readFileSync('src/routes/templates/+page.server.ts', 'utf8');
    const pageData = readFileSync('src/lib/server/page-data.ts', 'utf8');
    const repository = readFileSync('src/lib/server/repository/templates.ts', 'utf8');

    expect(templates).toContain('<h2>Email templates</h2>');
    expect(templates).not.toContain('Reusable personalized emails');
    expect(templates).toContain('Search templates');
    expect(templates).toContain('templatesPageHref');
    expect(templates).toContain('Page {currentTemplatesPage} of {totalTemplatesPages}');
    expect(templatesServer).toContain('page: Number(url.searchParams.get');
    expect(pageData).toContain('templatesPage = repo.listTemplatesPage');
    expect(repository).toContain('limit ? offset ?');
  });

  test('lets instructors reply to imported email replies from History', () => {
    const history = readFileSync('src/routes/communications/+page.svelte', 'utf8');
    const newEmail = readFileSync('src/routes/new-email/+page.svelte', 'utf8');
    const newEmailServer = readFileSync('src/routes/new-email/+page.server.ts', 'utf8');
    const pageData = readFileSync('src/lib/server/page-data.ts', 'utf8');

    expect(history).toContain('replyHref');
    expect(history).toContain('Reply');
    expect(history).toContain('without opening a new email');
    expect(history).not.toContain('compose workflow');
    expect(history).not.toContain('No reply yet');
    expect(history).not.toContain('Acknowledged');
    expect(history).not.toContain('<span class="pill good">Reviewed</span>');
    expect(history).not.toContain('new</span>');
    expect(history).toContain('Student replied');
    expect(history).toContain('Needs reply');
    expect(history).toContain('Reply reviewed');
    expect(history).toContain('/new-email?');
    expect(newEmailServer).toContain("url.searchParams.get('subject')");
    expect(newEmailServer).toContain("url.searchParams.get('body')");
    expect(pageData).toContain('prefillSubject');
    expect(pageData).toContain('prefillBody');
    expect(newEmail).toContain('data.prefillSubject');
    expect(newEmail).toContain('data.prefillBody');
  });
});
