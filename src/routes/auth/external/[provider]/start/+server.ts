import { redirect } from '@sveltejs/kit';
import { isAuthenticated } from '$lib/server/auth';
import {
  createExternalSignOnAuthorizationUrl,
  isExternalSignOnProvider,
  pkceChallenge,
  randomUrlToken,
  storeExternalSignOnRequest
} from '$lib/server/external-sign-on';

const externalSignOnErrorLocation = '/login?error=external';

export const GET = async ({ cookies, params, url }) => {
  const provider = params.provider;
  if (!isExternalSignOnProvider(provider)) {
    throw redirect(303, externalSignOnErrorLocation);
  }

  const mode = url.searchParams.get('mode') === 'link' ? 'link' : 'login';
  if (mode === 'link' && !isAuthenticated(cookies)) {
    throw redirect(303, externalSignOnErrorLocation);
  }

  const state = randomUrlToken();
  const nonce = randomUrlToken();
  const codeVerifier = randomUrlToken();
  const codeChallenge = pkceChallenge(codeVerifier);

  let authorizationUrl: URL;
  try {
    authorizationUrl = createExternalSignOnAuthorizationUrl({
      origin: url.origin,
      provider,
      mode,
      state,
      nonce,
      codeChallenge
    });
    storeExternalSignOnRequest(cookies, { provider, mode, state, nonce, codeVerifier });
  } catch {
    throw redirect(303, externalSignOnErrorLocation);
  }

  throw redirect(303, authorizationUrl.toString());
};
