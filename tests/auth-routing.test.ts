import { describe, expect, test } from 'vitest';
import { getAuthRedirect } from '../src/lib/server/auth';

describe('auth route access', () => {
  test('does not allow setup after an admin password exists', () => {
    expect(getAuthRedirect({ hasPassword: true, isAuthenticated: false, path: '/setup' })).toBe('/login');
  });

  test.each([
    '/auth/external/google/start',
    '/auth/external/google/callback',
    '/auth/external/entra/start',
    '/auth/external/entra/callback'
  ])('allows unauthenticated external sign-on route %s when setup is complete', (path) => {
    expect(getAuthRedirect({ hasPassword: true, isAuthenticated: false, path })).toBeUndefined();
  });
});
