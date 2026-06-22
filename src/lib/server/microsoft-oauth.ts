import { repo } from './app';
import { getMicrosoftClientSecret, getMicrosoftRefreshToken, getSettings, setMicrosoftRefreshToken } from './settings';

const smtpScope = 'https://outlook.office.com/SMTP.Send';
const scopes = ['offline_access', smtpScope];

export function microsoftRedirectUri(origin: string) {
  const settings = getSettings();
  const baseUrl = settings.publicBaseUrl || origin;
  return `${baseUrl.replace(/\/$/, '')}/settings/microsoft/callback`;
}

export function microsoftAuthorizeUrl({ origin, state }: { origin: string; state: string }) {
  const settings = getSettings();
  if (!settings.microsoftClientId) throw new Error('Enter a Microsoft client ID before connecting Outlook.');

  const params = new URLSearchParams({
    client_id: settings.microsoftClientId,
    response_type: 'code',
    redirect_uri: microsoftRedirectUri(origin),
    response_mode: 'query',
    scope: scopes.join(' '),
    state,
    prompt: 'consent'
  });

  return `${authority(settings.microsoftTenantId)}/oauth2/v2.0/authorize?${params}`;
}

export async function connectMicrosoftAccount({ code, origin }: { code: string; origin: string }) {
  const token = await requestMicrosoftToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: microsoftRedirectUri(origin),
    scope: scopes.join(' ')
  });
  if (!token.refresh_token) throw new Error('Microsoft did not return a refresh token. Confirm offline_access was approved.');
  setMicrosoftRefreshToken(token.refresh_token);
  repo.setSetting('smtp.authMethod', 'microsoft-oauth2');
  repo.setSetting('smtp.host', 'smtp.office365.com');
  repo.setSetting('smtp.port', '587');
}

export async function getMicrosoftSmtpAccessToken() {
  const refreshToken = getMicrosoftRefreshToken();
  if (!refreshToken) throw new Error('Connect Outlook in Settings before sending with Microsoft OAuth2.');

  const token = await requestMicrosoftToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: scopes.join(' ')
  });
  if (token.refresh_token) setMicrosoftRefreshToken(token.refresh_token);
  if (!token.access_token) throw new Error('Microsoft did not return an access token.');
  return token.access_token;
}

async function requestMicrosoftToken(body: Record<string, string>) {
  const settings = getSettings();
  const clientSecret = getMicrosoftClientSecret();
  if (!settings.microsoftClientId || !clientSecret) {
    throw new Error('Enter Microsoft client ID and client secret before connecting Outlook.');
  }

  const response = await fetch(`${authority(settings.microsoftTenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: settings.microsoftClientId,
      client_secret: clientSecret,
      ...body
    })
  });

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok) throw new Error(payload.error_description || payload.error || 'Microsoft OAuth token request failed.');
  return payload;
}

function authority(tenantId: string) {
  return `https://login.microsoftonline.com/${tenantId || 'common'}`;
}
