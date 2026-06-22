import { randomBytes } from 'node:crypto';
import { redirect } from '@sveltejs/kit';
import { microsoftAuthorizeUrl } from '$lib/server/microsoft-oauth';
import { getMicrosoftClientSecret, getSettings } from '$lib/server/settings';

const stateCookie = 'scuba_email_ms_oauth_state';

export const GET = ({ cookies, url }) => {
  const settings = getSettings();
  if (!settings.microsoftClientId || !getMicrosoftClientSecret()) {
    throw redirect(303, '/settings?message=Enter and save Microsoft client ID and client secret before connecting Outlook.');
  }
  const state = randomBytes(24).toString('hex');
  cookies.set(stateCookie, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.SCUBA_EMAIL_SECURE_COOKIES === 'true',
    path: '/',
    maxAge: 10 * 60
  });
  throw redirect(303, microsoftAuthorizeUrl({ origin: url.origin, state }));
};
