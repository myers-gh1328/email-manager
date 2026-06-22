import { redirect } from '@sveltejs/kit';
import { createSession } from '$lib/server/auth';
import {
  assertExternalSignOnIdentityMatches,
  consumeExternalSignOnRequest,
  exchangeExternalSignOnCode,
  isExternalSignOnProvider,
  linkExternalSignOnIdentity
} from '$lib/server/external-sign-on';

const externalSignOnErrorLocation = '/login?error=external';
const linkedLocation = '/settings?section=security&externalSignOn=linked';

export const GET = async ({ cookies, params, url }) => {
  const provider = params.provider;
  if (!isExternalSignOnProvider(provider)) {
    throw redirect(303, externalSignOnErrorLocation);
  }

  let location = '/';
  try {
    const request = consumeExternalSignOnRequest(cookies, provider);
    const state = url.searchParams.get('state') ?? '';
    if (state !== request.state) {
      throw new Error('External sign-on state mismatch.');
    }

    const code = url.searchParams.get('code');
    if (!code) {
      throw new Error('External sign-on code missing.');
    }

    const claims = await exchangeExternalSignOnCode({
      origin: url.origin,
      provider,
      code,
      state,
      codeVerifier: request.codeVerifier,
      nonce: request.nonce
    });

    if (request.mode === 'link') {
      linkExternalSignOnIdentity(provider, claims);
      location = linkedLocation;
    } else {
      assertExternalSignOnIdentityMatches(provider, claims);
      createSession(cookies);
    }
  } catch {
    throw redirect(303, externalSignOnErrorLocation);
  }

  throw redirect(303, location);
};
