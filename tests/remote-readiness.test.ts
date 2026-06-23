import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { remoteAccessStatus } from '../src/lib/server/page-data';
import { baseAppSettings } from './settings-helpers';

const settings = baseAppSettings({
  instructorName: 'Alex',
  publicBaseUrl: 'https://mail.example.com',
  remoteAccessEnabled: true,
  trustedProxyEnabled: true
});

describe('remote access readiness', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('reports concrete blockers when remote mode is enabled without hardening', () => {
    vi.stubEnv('SCUBA_EMAIL_APP_SECRET', '');
    vi.stubEnv('SCUBA_EMAIL_APP_SECRET_FILE', join(mkdtempSync(join(tmpdir(), 'scuba-secret-')), 'missing-secret'));
    vi.stubEnv('SCUBA_EMAIL_SECURE_COOKIES', 'false');

    const status = remoteAccessStatus(settings);

    expect(status.ready).toBe(false);
    expect(status.blockedReasons).toContain('Configure a persistent app secret before remote access');
    expect(status.blockedReasons).toContain('Set SCUBA_EMAIL_SECURE_COOKIES=true when serving over HTTPS');
  });

  test('reports ready remote mode when secure-cookie runtime setting is enabled', () => {
    vi.stubEnv('SCUBA_EMAIL_APP_SECRET', 'test-secret-with-enough-length');
    vi.stubEnv('SCUBA_EMAIL_SECURE_COOKIES', 'true');

    expect(remoteAccessStatus(settings)).toEqual({
      enabled: true,
      ready: true,
      blockedReasons: []
    });
  });

  test('does not require secure-cookie runtime setting for non-HTTPS public URLs', () => {
    vi.stubEnv('SCUBA_EMAIL_APP_SECRET', 'test-secret-with-enough-length');
    vi.stubEnv('SCUBA_EMAIL_SECURE_COOKIES', 'false');

    expect(remoteAccessStatus({ ...settings, publicBaseUrl: 'http://127.0.0.1:5173' })).toEqual({
      enabled: true,
      ready: true,
      blockedReasons: []
    });
  });

  test('treats blank public URLs as missing', () => {
    vi.stubEnv('SCUBA_EMAIL_APP_SECRET', 'test-secret-with-enough-length');
    vi.stubEnv('SCUBA_EMAIL_SECURE_COOKIES', 'false');

    const status = remoteAccessStatus({ ...settings, publicBaseUrl: '   ' });

    expect(status.ready).toBe(false);
    expect(status.blockedReasons).toContain('Set a public base URL for remote access');
    expect(status.blockedReasons).not.toContain('Set SCUBA_EMAIL_SECURE_COOKIES=true when serving over HTTPS');
  });

  test('reports local mode when remote access is disabled', () => {
    expect(remoteAccessStatus({ ...settings, remoteAccessEnabled: false })).toEqual({
      enabled: false,
      ready: true,
      blockedReasons: []
    });
  });
});
