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
    expect(dashboard).not.toContain('resendFailedToday');
    expect(dashboardServer).not.toContain('resendFailedToday');
    expect(dashboard).not.toContain('Resend failed today');
    expect(dashboard).not.toContain('approved due now');
    expect(dashboard).not.toContain('No upcoming approved sends');
    expect(dashboard).not.toContain('>Campaigns<');
    expect(dashboard).not.toContain('Manage campaigns');
    expect(dashboard).not.toContain("'Approved'");
    expect(dashboard).toContain('Attention needed');
    expect(dashboard).toContain('Scheduled Emails');
    expect(dashboard).toContain('Review failed emails');
  });

  test('keeps contact detail focused on recent email activity with a filtered History link', () => {
    const contacts = readFileSync('src/routes/contacts/+page.svelte', 'utf8');
    expect(contacts).not.toContain('Reusable student contacts');
    expect(contacts).toContain('<h2>Students and email recipients</h2>');
    expect(contacts).toContain('Recent emails');
    expect(contacts).toContain('View all in History');
    expect(contacts).toContain('/communications?contactId=');
    expect(contacts).not.toContain('Email activity');
  });

  test('keeps Classes focused on selecting scheduled classes, not setup data', () => {
    const classes = readFileSync('src/routes/classes/+page.svelte', 'utf8');
    expect(classes).toContain('<h2>Scheduled classes</h2>');
    expect(classes).toContain('Open class');
    expect(classes).toContain('href={`/classes/${session.id}`}');
    expect(classes).not.toContain('Course types and scheduled classes');
    expect(classes).not.toContain('Class management views');
    expect(classes).not.toContain('Checklist defaults');
    expect(classes).not.toContain('Add course type');
    expect(classes).not.toContain('Add location');
    expect(classes).not.toContain('Enroll student');
  });

  test('gives setup data a Settings App Data home', () => {
    const settings = readFileSync('src/routes/settings/+page.svelte', 'utf8');
    expect(settings).toContain('<summary>App Data</summary>');
    expect(settings).toContain('Course types');
    expect(settings).toContain('Locations');
    expect(settings).toContain('Class prep defaults');
    expect(settings).toContain('?/createCourse');
    expect(settings).toContain('?/createLocation');
    expect(settings).toContain('?/createChecklistItem');
  });

  test('uses plain scheduled-email language instead of approval campaign copy', () => {
    const scheduledEmails = readFileSync('src/routes/campaigns/+page.svelte', 'utf8');
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
    expect(scheduledEmailDetail).toContain('Scheduled email detail');
    expect(scheduledEmailDetail).toContain('Ready to send');
  });
});
