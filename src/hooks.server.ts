import { redirect, type Handle } from '@sveltejs/kit';
import { getAuthRedirect, hasAdminPassword, isAuthenticated } from '$lib/server/auth';
import { startBackgroundScheduler } from '$lib/server/background';
import { startExternalEventSubscriber } from '$lib/server/external-events-nats';

startBackgroundScheduler();
startExternalEventSubscriber();

export const handle: Handle = async ({ event, resolve }) => {
  const hasPassword = hasAdminPassword();
  const authed = hasPassword && isAuthenticated(event.cookies);
  event.locals.isAuthenticated = authed;

  const authRedirect = getAuthRedirect({ hasPassword, isAuthenticated: authed, path: event.url.pathname });
  if (authRedirect) throw redirect(303, authRedirect);

  return resolve(event);
};
