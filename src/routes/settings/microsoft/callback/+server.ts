import { redirect } from '@sveltejs/kit';
import { connectMicrosoftAccount } from '$lib/server/microsoft-oauth';

const stateCookie = 'scuba_email_ms_oauth_state';

export const GET = async ({ cookies, url }) => {
  const expectedState = cookies.get(stateCookie);
  cookies.delete(stateCookie, { path: '/' });

  const error = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (error) throw redirect(303, `/settings?message=${encodeURIComponent(error)}`);

  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!expectedState || state !== expectedState) {
    throw redirect(303, '/settings?message=Microsoft sign-in state did not match. Try connecting again.');
  }
  if (!code) throw redirect(303, '/settings?message=Microsoft did not return an authorization code.');

  try {
    await connectMicrosoftAccount({ code, origin: url.origin });
  } catch (error) {
    throw redirect(303, `/settings?message=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
  }
  throw redirect(303, '/settings?message=Outlook connected for SMTP sending.');
};
