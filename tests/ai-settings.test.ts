import { describe, expect, test } from 'vitest';
import { aiApiKeyForModelLoad } from '../src/lib/server/settings';
import { baseAppSettings } from './settings-helpers';

const settings = baseAppSettings({
  instructorName: 'Alex',
  aiEnabled: true,
  aiBaseUrl: 'http://localhost:1234/v1',
  aiApiKeyConfigured: true
});

describe('AI settings helpers', () => {
  test('does not reuse a saved AI key for a different posted base URL', () => {
    expect(aiApiKeyForModelLoad('http://evil.example/v1', '', settings, 'saved-key')).toBe('');
  });

  test('reuses a saved AI key only for the same base URL', () => {
    expect(aiApiKeyForModelLoad('http://localhost:1234/v1/', '', settings, 'saved-key')).toBe('saved-key');
  });

  test('prefers a newly posted AI key for unsaved model discovery', () => {
    expect(aiApiKeyForModelLoad('http://evil.example/v1', 'posted-key', settings, 'saved-key')).toBe('posted-key');
  });
});
