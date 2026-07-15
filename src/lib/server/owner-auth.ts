import { createOwnerOidc, type OwnerOidc, type OwnerOidcOptions } from '@myers-gh1328/owner-oidc';

type OwnerOidcFactory = (options: OwnerOidcOptions) => OwnerOidc;
type RuntimeEnv = Record<string, string | undefined>;

export function createDeploymentOwnerAuth(
  env: RuntimeEnv = process.env,
  factory: OwnerOidcFactory = createOwnerOidc
) {
  if (env.SCUBA_EMAIL_OWNER_AUTH_ENABLED !== 'true') return undefined;

  return factory({
    tenantId: uuid(env, 'SCUBA_EMAIL_ENTRA_TENANT_ID'),
    clientId: uuid(env, 'SCUBA_EMAIL_ENTRA_CLIENT_ID'),
    clientSecret: required(env, 'SCUBA_EMAIL_ENTRA_CLIENT_SECRET'),
    redirectUris: httpsUrls(env, 'SCUBA_EMAIL_ENTRA_REDIRECT_URIS', '/auth/callback'),
    postLogoutRedirectUri: httpsUrl(env, 'SCUBA_EMAIL_ENTRA_POST_LOGOUT_REDIRECT_URI'),
    allowedObjectIds: list(env, 'SCUBA_EMAIL_ENTRA_ALLOWED_OBJECT_IDS').map((value) =>
      assertUuid(value, 'SCUBA_EMAIL_ENTRA_ALLOWED_OBJECT_IDS')
    ),
    cookieSecret: required(env, 'SCUBA_EMAIL_OWNER_SESSION_SECRET'),
    cookiePrefix: 'email_manager',
    publicPaths: ['/healthz']
  });
}

function uuid(env: RuntimeEnv, name: string) {
  return assertUuid(required(env, name), name);
}

function assertUuid(value: string, name: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
    value === '00000000-0000-0000-0000-000000000000'
  ) {
    throw new Error(`${name} must contain UUID values.`);
  }
  return value;
}

function httpsUrls(env: RuntimeEnv, name: string, requiredPath: string) {
  const values = list(env, name);
  if (values.length !== 1) throw new Error(`${name} must contain exactly one URL.`);
  return values.map((value) => httpsUrlValue(value, name, requiredPath));
}

function httpsUrl(env: RuntimeEnv, name: string) {
  return httpsUrlValue(required(env, name), name);
}

function httpsUrlValue(value: string, name: string, requiredPath?: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must contain exact HTTPS URLs.`);
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (requiredPath && url.pathname !== requiredPath)
  ) {
    throw new Error(`${name} must contain exact HTTPS URLs.`);
  }
  return url.toString();
}

function required(env: RuntimeEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required when owner authentication is enabled.`);
  return value;
}

function list(env: RuntimeEnv, name: string) {
  const values = required(env, name)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0) throw new Error(`${name} must not be empty.`);
  return values;
}

export const deploymentOwnerAuth = createDeploymentOwnerAuth();

export async function applyOwnerAuth(auth: OwnerOidc, request: Request) {
  const authRouteResponse = await auth.handle(request);
  if (authRouteResponse) return { authenticated: false, response: authRouteResponse };

  if (new URL(request.url).pathname === '/logout') {
    return {
      authenticated: false,
      response: new Response(null, { status: 303, headers: { location: '/auth/logout' } })
    };
  }

  const protectionResponse = auth.protect(request);
  if (protectionResponse) return { authenticated: false, response: protectionResponse };
  return { authenticated: auth.session(request).authenticated };
}
