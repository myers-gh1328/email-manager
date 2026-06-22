import { describe, expect, test } from 'vitest';
import { formatPhoneNumber } from '../src/lib/shared/phone';

describe('phone formatting', () => {
  test('formats ten digit US phone numbers', () => {
    expect(formatPhoneNumber('5551234567')).toBe('(555) 123-4567');
  });

  test('formats US phone numbers with country code', () => {
    expect(formatPhoneNumber('+1 555 123 4567')).toBe('+1 (555) 123-4567');
  });

  test('preserves custom values that cannot be safely normalized', () => {
    expect(formatPhoneNumber('+44 20 7946 0958')).toBe('+44 20 7946 0958');
  });
});
