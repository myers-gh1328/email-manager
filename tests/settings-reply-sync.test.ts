import { beforeEach, describe, expect, test, vi } from 'vitest';

const settings = vi.hoisted(() => new Map<string, string>());

vi.mock('../src/lib/server/app', () => ({
  repo: {
    getSetting: (key: string) => settings.get(key) ?? '',
    setSetting: (key: string, value: string) => settings.set(key, value)
  }
}));

describe('reply sync settings', () => {
  beforeEach(() => {
    settings.clear();
  });

  test('defaults reply sync mode to IMAP for existing installs', async () => {
    const { getSettings } = await import('../src/lib/server/settings');

    expect(getSettings().replySyncMode).toBe('imap');
  });

  test('disabled reply sync saves no polling while preserving inactive IMAP fields', async () => {
    const { updateReplySyncSettings } = await import('../src/lib/server/settings');
    const form = new FormData();
    form.set('replySyncMode', 'disabled');
    form.set('replySyncHost', 'imap.example.com');
    form.set('replySyncPort', '993');
    form.set('replySyncTls', 'on');
    form.set('replySyncUsername', 'user@example.com');
    form.set('replySyncPollingEnabled', 'on');

    updateReplySyncSettings(form);

    expect(settings.get('replySync.mode')).toBe('disabled');
    expect(settings.get('replySync.pollingEnabled')).toBe('false');
    expect(settings.get('replySync.host')).toBe('imap.example.com');
    expect(settings.get('replySync.username')).toBe('user@example.com');
  });

  test('IMAP reply sync can keep automatic polling enabled', async () => {
    const { updateReplySyncSettings } = await import('../src/lib/server/settings');
    const form = new FormData();
    form.set('replySyncMode', 'imap');
    form.set('replySyncPollingEnabled', 'on');

    updateReplySyncSettings(form);

    expect(settings.get('replySync.mode')).toBe('imap');
    expect(settings.get('replySync.pollingEnabled')).toBe('true');
  });

  test('saves self-signed certificate trust only for loopback IMAP', async () => {
    const { updateReplySyncSettings } = await import('../src/lib/server/settings');
    const form = new FormData();
    form.set('replySyncMode', 'imap');
    form.set('replySyncHost', '127.0.0.1');
    form.set('replySyncAllowSelfSignedCertificate', 'on');

    updateReplySyncSettings(form);
    expect(settings.get('replySync.allowSelfSignedCertificate')).toBe('true');

    form.set('replySyncHost', 'imap.example.com');
    updateReplySyncSettings(form);
    expect(settings.get('replySync.allowSelfSignedCertificate')).toBe('false');
  });

  test('enables certificate trust for an existing local Proton Bridge setup', async () => {
    settings.set('replySync.host', '127.0.0.1');
    settings.set('replySync.port', '1143');
    const { getSettings } = await import('../src/lib/server/settings');

    expect(getSettings().replySyncAllowSelfSignedCertificate).toBe(true);
  });
});
