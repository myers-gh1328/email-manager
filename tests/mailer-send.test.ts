import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('sendOutboundEmail failure boundaries', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  test('resolves after SMTP acceptance even when test-audit recording fails', async () => {
    const recordEmailTestAudit = vi.fn(() => {
      throw new Error('database unavailable');
    });
    const { sendOutboundEmail, sendMail, consoleError } = await loadMailer({
      emailTestModeEnabled: true,
      sendMailResult: { messageId: 'provider-123', accepted: ['instructor@example.com'], rejected: [] },
      recordEmailTestAudit
    });

    await expect(sendOutboundEmail({ to: 'maya@example.com', subject: 'Hi', text: 'Hello' })).resolves.toMatchObject({
      providerMessage: 'provider-123',
      originalRecipient: 'maya@example.com',
      effectiveRecipient: 'instructor@example.com',
      testMode: true
    });

    expect(sendMail).toHaveBeenCalledOnce();
    expect(recordEmailTestAudit).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith('Email test audit recording failed after SMTP acceptance.');
  });

  test('rejects when SMTP resolves without accepting the effective recipient', async () => {
    const { sendOutboundEmail } = await loadMailer({
      sendMailResult: { messageId: 'provider-123', accepted: [], rejected: ['maya@example.com'] }
    });

    await expect(sendOutboundEmail({ to: 'maya@example.com', subject: 'Hi', text: 'Hello' })).rejects.toThrow(
      'SMTP provider did not accept the recipient.'
    );
  });
});

async function loadMailer({
  emailTestModeEnabled = false,
  sendMailResult,
  recordEmailTestAudit = vi.fn()
}: {
  emailTestModeEnabled?: boolean;
  sendMailResult: unknown;
  recordEmailTestAudit?: ReturnType<typeof vi.fn>;
}) {
  const sendMail = vi.fn(async () => sendMailResult);
  const createTransport = vi.fn(() => ({ sendMail }));
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  vi.doMock('nodemailer', () => ({
    default: { createTransport }
  }));
  vi.doMock('../src/lib/server/app', () => ({
    repo: {
      recordEmailTestAudit,
      getSetting: vi.fn()
    }
  }));
  vi.doMock('../src/lib/server/settings', () => ({
    getSettings: () => ({
      smtpHost: 'smtp.example.com',
      smtpPort: '587',
      smtpFrom: 'instructor@example.com',
      smtpUser: '',
      smtpAuthMethod: 'password',
      emailTestModeEnabled,
      emailSignature: '',
      publicBaseUrl: ''
    }),
    getSmtpPassword: () => ''
  }));
  vi.doMock('../src/lib/server/microsoft-oauth', () => ({
    getMicrosoftSmtpAccessToken: vi.fn()
  }));

  const { sendOutboundEmail } = await import('../src/lib/server/mailer');
  return { sendOutboundEmail, sendMail, recordEmailTestAudit, consoleError };
}
