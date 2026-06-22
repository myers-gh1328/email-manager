import { fail, redirect } from '@sveltejs/kit';
import { clearLoginFailures, createSession, loginThrottleStatus, recordLoginFailure, verifyAdminPassword } from '$lib/server/auth';
import { getExternalSignOnStatus } from '$lib/server/external-sign-on';

export const load = ({ url }) => ({
  externalSignOn: getExternalSignOnStatus(),
  externalError: url.searchParams.get('error') === 'external'
});

export const actions = {
  default: async ({ request, cookies, getClientAddress }) => {
    const clientKey = getClientAddress();
    const throttle = loginThrottleStatus(clientKey);
    if (throttle.limited) {
      return fail(429, { message: `Too many failed login attempts. Try again in ${throttle.retryAfterSeconds} seconds.` });
    }
    const form = await request.formData();
    const password = String(form.get('password') ?? '');
    if (!verifyAdminPassword(password)) {
      recordLoginFailure(clientKey);
      return fail(400, { message: 'Password did not match.' });
    }
    clearLoginFailures(clientKey);
    createSession(cookies);
    throw redirect(303, '/');
  }
};
