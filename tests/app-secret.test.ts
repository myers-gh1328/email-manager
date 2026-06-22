import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getAppSecret, getAppSecretStatus } from '../src/lib/server/app-secret';

describe('app secret management', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('uses an explicit environment secret when configured', () => {
    vi.stubEnv('SCUBA_EMAIL_APP_SECRET', 'explicit-secret');

    expect(getAppSecret()).toBe('explicit-secret');
    expect(getAppSecretStatus()).toMatchObject({ configured: true, source: 'env' });
  });

  test('generates and reuses a persistent local secret file', () => {
    const filePath = join(mkdtempSync(join(tmpdir(), 'scuba-secret-')), 'app-secret');
    vi.stubEnv('SCUBA_EMAIL_APP_SECRET', '');
    vi.stubEnv('SCUBA_EMAIL_APP_SECRET_FILE', filePath);

    const first = getAppSecret();
    const second = getAppSecret();

    expect(first).toBe(second);
    expect(first).not.toBe('development-secret-change-before-remote-access');
    expect(readFileSync(filePath, 'utf8').trim()).toBe(first);
    expect(getAppSecretStatus()).toEqual({ configured: true, source: 'generated', filePath });
  });
});
