import { describe, expect, test } from 'vitest';
import { getAuthRedirect } from '../src/lib/server/auth';

describe('auth route access', () => {
  test('does not allow setup after an admin password exists', () => {
    expect(getAuthRedirect({ hasPassword: true, isAuthenticated: false, path: '/setup' })).toBe('/login');
  });
});
