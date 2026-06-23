import { describe, expect, test } from 'vitest';
import { normalizedPublicBaseUrl } from '../src/lib/server/settings';

describe('settings helpers', () => {
  test('normalizes blank public base URLs', () => {
    expect(normalizedPublicBaseUrl(null)).toBe('');
    expect(normalizedPublicBaseUrl('   ')).toBe('');
  });

  test('normalizes HTTP and HTTPS public base URL origins', () => {
    expect(normalizedPublicBaseUrl('https://mail.example.com/')).toBe('https://mail.example.com');
    expect(normalizedPublicBaseUrl(' http://127.0.0.1:5173 ')).toBe('http://127.0.0.1:5173');
  });

  test('rejects invalid public base URLs', () => {
    expect(() => normalizedPublicBaseUrl('not-a-url')).toThrow('Public base URL must be a valid HTTP or HTTPS URL.');
    expect(() => normalizedPublicBaseUrl('ftp://mail.example.com')).toThrow(
      'Public base URL must be a valid HTTP or HTTPS URL.'
    );
    expect(() => normalizedPublicBaseUrl(new File([], 'url.txt'))).toThrow(
      'Public base URL must be a valid HTTP or HTTPS URL.'
    );
  });

  test('rejects public base URLs with paths or query state', () => {
    expect(() => normalizedPublicBaseUrl('https://mail.example.com/app')).toThrow(
      'Public base URL must include only the scheme and host.'
    );
    expect(() => normalizedPublicBaseUrl('https://mail.example.com/?mode=remote')).toThrow(
      'Public base URL must include only the scheme and host.'
    );
    expect(() => normalizedPublicBaseUrl('https://mail.example.com/#remote')).toThrow(
      'Public base URL must include only the scheme and host.'
    );
  });
});
