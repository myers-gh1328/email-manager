import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { navigationItems } from '../src/lib/shared/navigation';

describe('navigation visibility', () => {
  test('uses plain operator language for email workflow navigation', () => {
    const items = navigationItems({ emailTestModeEnabled: true });
    const labels = items.map((item) => item.label);
    expect(labels).toContain('Scheduled Emails');
    expect(labels).toContain('History');
    expect(labels).toContain('New Email');
    expect(labels).toContain('Test Sends');
    expect(labels).not.toContain('Campaigns');
    expect(labels).not.toContain('Communications');
    expect(labels).not.toContain('Test audit');
    expect(items.find((item) => item.label === 'Scheduled Emails')?.href).toBe('/scheduled-emails');
    expect(items.find((item) => item.label === 'History')?.href).toBe('/history');
  });

  test('uses plain operator language on email workflow pages', () => {
    const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
    const scheduledEmailsPage = readFileSync('src/routes/scheduled-emails/+page.svelte', 'utf8');
    const historyPage = readFileSync('src/routes/history/+page.svelte', 'utf8');
    const newEmailPage = readFileSync('src/routes/new-email/+page.svelte', 'utf8');
    const testSendsPage = readFileSync('src/routes/test-audit/+page.svelte', 'utf8');

    expect(layout).toContain('<h1>Training Communications Studio</h1>');
    expect(layout).toContain('<p class="eyebrow">Email operations</p>');
    expect(layout).not.toContain('<h1>Class communications</h1>');

    expect(scheduledEmailsPage).toContain('<title>Scheduled Emails · Training Communications Studio</title>');
    expect(scheduledEmailsPage).toContain('<p class="eyebrow">Scheduled Emails</p>');
    expect(scheduledEmailsPage).not.toContain('>Campaigns<');
    expect(scheduledEmailsPage).not.toContain('Approved after preview');
    expect(scheduledEmailsPage).not.toContain('name="approved"');
    expect(scheduledEmailsPage).not.toContain('Schedule after preview');
    expect(scheduledEmailsPage).toContain('name="scheduleMode" type="hidden" value="ready"');
    expect(scheduledEmailsPage).not.toContain('name="scheduleMode" type="hidden" value="draft"');
    expect(scheduledEmailsPage).toContain("value: 'needs_preview', label: 'Needs preview'");

    expect(historyPage).toContain('<title>History · Training Communications Studio</title>');
    expect(historyPage).toContain('<p class="eyebrow">History</p>');
    expect(historyPage).toContain('newEmailHref');
    expect(historyPage).toContain('href={newEmailHref}');
    expect(historyPage).not.toContain('>Communications<');
    expect(historyPage).not.toContain('Scheduled campaign');
    expect(historyPage).not.toContain('Compose email');
    expect(historyPage).not.toContain('sendDirectEmail');

    expect(newEmailPage).toContain('<title>New Email · Training Communications Studio</title>');
    expect(newEmailPage).toContain('<p class="eyebrow">New Email</p>');
    expect(newEmailPage).toContain('<h2>Write a new email</h2>');
    expect(newEmailPage).toContain('<h3>Compose direct email</h3>');
    expect(newEmailPage).toContain('<h3>Email preview</h3>');
    expect(newEmailPage).toContain('<button type="submit">Preview email</button>');
    expect(newEmailPage).not.toContain('<h3>Preview</h3>');
    expect(newEmailPage).not.toContain('<button type="submit">Preview</button>');
    expect(newEmailPage).not.toContain('<h3>Email details</h3>');
    expect(newEmailPage).not.toContain('<h3>Compose email</h3>');
    expect(newEmailPage).not.toContain('one-off');

    expect(testSendsPage).toContain('<title>Test Sends · Training Communications Studio</title>');
    expect(testSendsPage).not.toContain('Test audit');
  });

  test('shows test audit only while email test mode is enabled', () => {
    expect(navigationItems({ emailTestModeEnabled: false }).map((item) => item.href)).not.toContain('/test-audit');
    expect(navigationItems({ emailTestModeEnabled: true }).map((item) => item.href)).toContain('/test-audit');
  });

  test('uses an icon-only mobile navigation toggle with an accessible label', () => {
    const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
    expect(layout).toContain('aria-label={navOpen ?');
    expect(layout).toContain('<span aria-hidden="true"></span>');
    expect(layout).not.toContain('>Menu</button>');
  });
});
