import { fail, redirect } from '@sveltejs/kit';
import { createSession, hasAdminPassword, setAdminPassword } from '$lib/server/auth';
import { formText } from '$lib/server/form-utils';

export const actions = {
  default: async ({ request, cookies }) => {
    if (hasAdminPassword()) {
      throw redirect(303, '/login');
    }
    const form = await request.formData();
    const password = formText(form.get('password'));
    if (password.length < 10) {
      return fail(400, { message: 'Use at least 10 characters for the admin password.' });
    }
    setAdminPassword(password);
    createSession(cookies);
    throw redirect(303, '/');
  }
};
