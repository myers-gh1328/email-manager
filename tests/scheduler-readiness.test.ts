import { describe, expect, test } from 'vitest';
import { schedulerStatus } from '../src/lib/server/page-data';
import { baseAppSettings } from './settings-helpers';

const baseSettings = baseAppSettings({
  instructorName: 'Alex',
  schedulerEnabled: true,
  smtpHost: 'smtp.example.com',
  smtpUser: 'alex@example.com',
  smtpFrom: 'alex@example.com',
  smtpPasswordConfigured: true
});

describe('scheduler readiness', () => {
  test('blocks password SMTP when username is set but password is missing', () => {
    const status = schedulerStatus({ ...baseSettings, smtpPasswordConfigured: false }, []);

    expect(status.ready).toBe(false);
    expect(status.blockedReasons).toContain('SMTP authentication is incomplete');
  });

  test('blocks Microsoft SMTP when refresh token is missing', () => {
    const status = schedulerStatus(
      { ...baseSettings, smtpAuthMethod: 'microsoft-oauth2', microsoftRefreshTokenConfigured: false },
      []
    );

    expect(status.ready).toBe(false);
    expect(status.blockedReasons).toContain('Microsoft Outlook is not connected');
  });
});
