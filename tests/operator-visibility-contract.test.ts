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
    expect(dashboard).not.toContain('resendFailedToday');
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
});
