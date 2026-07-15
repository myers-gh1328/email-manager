import { redirect, type Handle } from '@sveltejs/kit';
import { getAuthRedirect, hasAdminPassword, isAuthenticated } from '$lib/server/auth';
import { startBackgroundScheduler } from '$lib/server/background';
import { startExternalEventSubscriber } from '$lib/server/external-events-nats';
import { applyOwnerAuth, deploymentOwnerAuth } from '$lib/server/owner-auth';

startBackgroundScheduler();
startExternalEventSubscriber();

export const handle: Handle = async ({ event, resolve }) => {
  if (deploymentOwnerAuth) {
    const ownerAuth = await applyOwnerAuth(deploymentOwnerAuth, event.request);
    if (ownerAuth.response) return ownerAuth.response;
    event.locals.isAuthenticated = ownerAuth.authenticated;
    return resolve(event);
  }

  const hasPassword = hasAdminPassword();
  const authed = hasPassword && isAuthenticated(event.cookies);
  event.locals.isAuthenticated = authed;

  const authRedirect = getAuthRedirect({ hasPassword, isAuthenticated: authed, path: event.url.pathname });
  if (authRedirect) throw redirect(303, authRedirect);

  return resolve(event);
};
