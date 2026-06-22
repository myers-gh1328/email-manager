# Single-User External Sign-On Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional single-owner sign-on through either Google or Microsoft Entra ID while keeping the local admin password as the required recovery and control path.

**Architecture:** Implement sign-on as a server-only OIDC layer that stores installation-level settings, validates provider callbacks, and creates the existing local session type. Keep routes thin, keep settings grouped under Security, and document provider setup in plain language for non-developer users.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Vitest, node:crypto, existing encrypted settings, existing local session cookies, and a maintained OIDC client dependency such as `openid-client`.

---

## File Structure

- Create `src/lib/server/external-sign-on.ts`: provider metadata, redirect URI helpers, settings parsing, state/nonce/PKCE helpers, authorization URL creation, callback validation, linked-identity checks, and settings persistence helpers.
- Modify `src/lib/server/settings.ts`: expose external sign-on configuration status without decrypted secrets and add grouped update helpers for provider settings.
- Modify `src/lib/server/auth.ts`: reuse existing password verification and session creation; add exported helpers only if needed by settings actions.
- Modify `src/routes/settings/+page.server.ts`: add Security actions for saving sign-on settings, starting a link flow, and removing linked sign-on after password confirmation.
- Modify `src/routes/settings/+page.svelte`: add a collapsible Security subsection for external sign-on with copyable redirect address, provider selection, credential fields, linked identity status, connect button, and remove button.
- Create `src/routes/auth/external/[provider]/start/+server.ts`: start login or link authorization flow.
- Create `src/routes/auth/external/[provider]/callback/+server.ts`: validate callback and either link identity or create the existing app session.
- Modify `src/routes/login/+page.server.ts`: load external sign-on availability and redirect errors.
- Modify `src/routes/login/+page.svelte`: show a provider sign-on button only when one linked identity is configured.
- Add `tests/external-sign-on.test.ts`: pure server helper tests for settings, redirect URIs, state, nonce, PKCE, provider matching, and secret preservation.
- Add `tests/external-sign-on-routes.test.ts`: route/action tests for login visibility, password confirmation, connect/remove behavior, and callback success/failure.
- Modify `tests/auth-routing.test.ts` or add focused coverage in the new route test file if current route tests already own login/setup behavior.
- Modify `README.md`: add user-facing sign-on explanation and links to setup help.
- Create `docs/EXTERNAL-SIGN-ON.md`: plain-language setup guide for Google and Entra ID, including what values to copy, where to paste redirect addresses, and how to recover with password login.
- Modify `docs/ARCHITECTURE.md`: document that external sign-on is single-user sign-on only and not account management.
- Modify `docs/OPEN-SOURCE-READINESS.md`: document that no shared OAuth credentials or hosted auth service are provided.
- Modify `package.json` and lockfile: add the chosen OIDC client dependency.

---

### Task 1: Add OIDC Dependency And Baseline Types

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/server/external-sign-on.ts`
- Test: `tests/external-sign-on.test.ts`

- [ ] **Step 1: Install the OIDC client dependency**

Run:

```bash
npm install openid-client
```

Expected: `package.json` and `package-lock.json` include `openid-client`.

- [ ] **Step 2: Write failing provider status tests**

Create `tests/external-sign-on.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/server/repository/index', () => {
  const settings = new Map<string, string>();
  return {
    repo: {
      getSetting: (key: string) => settings.get(key) ?? '',
      setSetting: (key: string, value: string) => {
        settings.set(key, value);
      },
      deleteSetting: (key: string) => {
        settings.delete(key);
      },
      __clear: () => settings.clear()
    }
  };
});

describe('external sign-on settings', () => {
  beforeEach(async () => {
    const { repo } = await import('../src/lib/server/repository/index');
    repo.__clear();
  });

  it('reports disabled when no linked identity exists', async () => {
    const { getExternalSignOnStatus } = await import('../src/lib/server/external-sign-on');

    expect(getExternalSignOnStatus()).toEqual({
      enabled: false,
      provider: '',
      providerLabel: '',
      email: '',
      name: '',
      linkedAt: '',
      googleClientId: '',
      googleClientSecretConfigured: false,
      entraTenant: 'common',
      entraClientId: '',
      entraClientSecretConfigured: false
    });
  });

  it('reports one linked Google identity without exposing the secret', async () => {
    const { repo } = await import('../src/lib/server/repository/index');
    const { encryptSecret } = await import('../src/lib/server/crypto');
    const { getExternalSignOnStatus } = await import('../src/lib/server/external-sign-on');

    repo.setSetting('auth.sso.provider', 'google');
    repo.setSetting('auth.sso.subject', 'google-subject');
    repo.setSetting('auth.sso.email', 'owner@example.com');
    repo.setSetting('auth.sso.name', 'Owner Example');
    repo.setSetting('auth.sso.linkedAt', '2026-06-22T00:00:00.000Z');
    repo.setSetting('auth.sso.google.clientId', 'google-client-id');
    repo.setSetting('auth.sso.google.clientSecret', encryptSecret('google-client-secret'));

    expect(JSON.stringify(getExternalSignOnStatus())).not.toContain('google-client-secret');
    expect(getExternalSignOnStatus()).toMatchObject({
      enabled: true,
      provider: 'google',
      providerLabel: 'Google',
      email: 'owner@example.com',
      name: 'Owner Example',
      googleClientSecretConfigured: true
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```bash
npm test -- tests/external-sign-on.test.ts
```

Expected: FAIL because `src/lib/server/external-sign-on.ts` does not exist or does not export `getExternalSignOnStatus`.

- [ ] **Step 4: Implement baseline settings status**

Create `src/lib/server/external-sign-on.ts` with:

```ts
import { createHash, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { decryptSecret, encryptSecret } from './crypto';
import { repo } from './repository/index';

export type ExternalSignOnProvider = 'google' | 'entra';

export type ExternalSignOnStatus = {
  enabled: boolean;
  provider: ExternalSignOnProvider | '';
  providerLabel: string;
  email: string;
  name: string;
  linkedAt: string;
  googleClientId: string;
  googleClientSecretConfigured: boolean;
  entraTenant: string;
  entraClientId: string;
  entraClientSecretConfigured: boolean;
};

const providerLabels: Record<ExternalSignOnProvider, string> = {
  google: 'Google',
  entra: 'Microsoft Entra ID'
};

export function isExternalSignOnProvider(value: string): value is ExternalSignOnProvider {
  return value === 'google' || value === 'entra';
}

export function getExternalSignOnStatus(): ExternalSignOnStatus {
  const provider = repo.getSetting('auth.sso.provider');
  const validProvider = isExternalSignOnProvider(provider) ? provider : '';

  return {
    enabled: Boolean(validProvider && repo.getSetting('auth.sso.subject')),
    provider: validProvider,
    providerLabel: validProvider ? providerLabels[validProvider] : '',
    email: repo.getSetting('auth.sso.email'),
    name: repo.getSetting('auth.sso.name'),
    linkedAt: repo.getSetting('auth.sso.linkedAt'),
    googleClientId: repo.getSetting('auth.sso.google.clientId'),
    googleClientSecretConfigured: Boolean(repo.getSetting('auth.sso.google.clientSecret')),
    entraTenant: repo.getSetting('auth.sso.entra.tenant') || 'common',
    entraClientId: repo.getSetting('auth.sso.entra.clientId'),
    entraClientSecretConfigured: Boolean(repo.getSetting('auth.sso.entra.clientSecret'))
  };
}

export function getExternalSignOnClientSecret(provider: ExternalSignOnProvider) {
  const key = provider === 'google' ? 'auth.sso.google.clientSecret' : 'auth.sso.entra.clientSecret';
  return decryptSecret(repo.getSetting(key));
}

export function randomUrlToken() {
  return randomBytes(32).toString('base64url');
}

export function pkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
npm test -- tests/external-sign-on.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/server/external-sign-on.ts tests/external-sign-on.test.ts
git commit -m "feat: add external sign-on settings status"
```

---

### Task 2: Add Provider Settings Persistence

**Files:**
- Modify: `src/lib/server/external-sign-on.ts`
- Modify: `src/lib/server/settings.ts`
- Test: `tests/external-sign-on.test.ts`

- [ ] **Step 1: Add failing settings update tests**

Append to `tests/external-sign-on.test.ts`:

```ts
describe('external sign-on provider settings', () => {
  beforeEach(async () => {
    const { repo } = await import('../src/lib/server/repository/index');
    repo.__clear();
  });

  it('saves Google provider settings and preserves a blank replacement secret', async () => {
    const { getExternalSignOnClientSecret, getExternalSignOnStatus, updateExternalSignOnProviderSettings } =
      await import('../src/lib/server/external-sign-on');

    updateExternalSignOnProviderSettings({
      provider: 'google',
      googleClientId: 'first-google-client',
      googleClientSecret: 'first-google-secret',
      entraTenant: '',
      entraClientId: '',
      entraClientSecret: ''
    });

    updateExternalSignOnProviderSettings({
      provider: 'google',
      googleClientId: 'second-google-client',
      googleClientSecret: '',
      entraTenant: '',
      entraClientId: '',
      entraClientSecret: ''
    });

    expect(getExternalSignOnStatus()).toMatchObject({
      provider: 'google',
      googleClientId: 'second-google-client',
      googleClientSecretConfigured: true
    });
    expect(getExternalSignOnClientSecret('google')).toBe('first-google-secret');
  });

  it('saves Entra provider settings and normalizes blank tenant to common', async () => {
    const { getExternalSignOnClientSecret, getExternalSignOnStatus, updateExternalSignOnProviderSettings } =
      await import('../src/lib/server/external-sign-on');

    updateExternalSignOnProviderSettings({
      provider: 'entra',
      googleClientId: '',
      googleClientSecret: '',
      entraTenant: '',
      entraClientId: 'entra-client',
      entraClientSecret: 'entra-secret'
    });

    expect(getExternalSignOnStatus()).toMatchObject({
      provider: 'entra',
      entraTenant: 'common',
      entraClientId: 'entra-client',
      entraClientSecretConfigured: true
    });
    expect(getExternalSignOnClientSecret('entra')).toBe('entra-secret');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/external-sign-on.test.ts
```

Expected: FAIL because `updateExternalSignOnProviderSettings` is missing.

- [ ] **Step 3: Implement provider settings persistence**

Add to `src/lib/server/external-sign-on.ts`:

```ts
export type ExternalSignOnProviderSettingsInput = {
  provider: string;
  googleClientId: string;
  googleClientSecret: string;
  entraTenant: string;
  entraClientId: string;
  entraClientSecret: string;
};

function clean(value: string) {
  return value.trim();
}

export function updateExternalSignOnProviderSettings(input: ExternalSignOnProviderSettingsInput) {
  if (!isExternalSignOnProvider(input.provider)) {
    throw new Error('Choose Google or Microsoft Entra ID.');
  }

  repo.setSetting('auth.sso.provider', input.provider);

  if (input.provider === 'google') {
    repo.setSetting('auth.sso.google.clientId', clean(input.googleClientId));
    const secret = clean(input.googleClientSecret);
    if (secret) repo.setSetting('auth.sso.google.clientSecret', encryptSecret(secret));
    return;
  }

  repo.setSetting('auth.sso.entra.tenant', clean(input.entraTenant) || 'common');
  repo.setSetting('auth.sso.entra.clientId', clean(input.entraClientId));
  const secret = clean(input.entraClientSecret);
  if (secret) repo.setSetting('auth.sso.entra.clientSecret', encryptSecret(secret));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- tests/external-sign-on.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/external-sign-on.ts tests/external-sign-on.test.ts
git commit -m "feat: save external sign-on provider settings"
```

---

### Task 3: Add Redirect URI And Authorization Request Helpers

**Files:**
- Modify: `src/lib/server/external-sign-on.ts`
- Test: `tests/external-sign-on.test.ts`

- [ ] **Step 1: Add failing redirect and authorization tests**

Append to `tests/external-sign-on.test.ts`:

```ts
describe('external sign-on authorization requests', () => {
  beforeEach(async () => {
    const { repo } = await import('../src/lib/server/repository/index');
    repo.__clear();
  });

  it('builds provider callback URIs from public base URL when configured', async () => {
    const { repo } = await import('../src/lib/server/repository/index');
    const { externalSignOnRedirectUri } = await import('../src/lib/server/external-sign-on');

    repo.setSetting('server.publicBaseUrl', 'https://app.example.com/');

    expect(externalSignOnRedirectUri('https://localhost:5173', 'google')).toBe(
      'https://app.example.com/auth/external/google/callback'
    );
  });

  it('builds provider callback URIs from request origin when public base URL is blank', async () => {
    const { externalSignOnRedirectUri } = await import('../src/lib/server/external-sign-on');

    expect(externalSignOnRedirectUri('http://127.0.0.1:5173', 'entra')).toBe(
      'http://127.0.0.1:5173/auth/external/entra/callback'
    );
  });

  it('creates a Google authorization URL with only sign-on scopes', async () => {
    const { updateExternalSignOnProviderSettings, createExternalSignOnAuthorizationUrl } =
      await import('../src/lib/server/external-sign-on');

    updateExternalSignOnProviderSettings({
      provider: 'google',
      googleClientId: 'google-client',
      googleClientSecret: 'google-secret',
      entraTenant: '',
      entraClientId: '',
      entraClientSecret: ''
    });

    const url = createExternalSignOnAuthorizationUrl({
      origin: 'https://app.example.com',
      provider: 'google',
      mode: 'login',
      state: 'state-value',
      nonce: 'nonce-value',
      codeChallenge: 'challenge-value'
    });

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('google-client');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(url.searchParams.get('nonce')).toBe('nonce-value');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('access_type')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/external-sign-on.test.ts
```

Expected: FAIL because redirect and authorization helpers are missing.

- [ ] **Step 3: Implement redirect and authorization helpers**

Add to `src/lib/server/external-sign-on.ts`:

```ts
export type ExternalSignOnMode = 'login' | 'link';

export type ExternalSignOnAuthorizationInput = {
  origin: string;
  provider: ExternalSignOnProvider;
  mode: ExternalSignOnMode;
  state: string;
  nonce: string;
  codeChallenge: string;
};

export function externalSignOnRedirectUri(origin: string, provider: ExternalSignOnProvider) {
  const baseUrl = repo.getSetting('server.publicBaseUrl') || origin;
  return `${baseUrl.replace(/\/$/, '')}/auth/external/${provider}/callback`;
}

function providerAuthorizeEndpoint(provider: ExternalSignOnProvider) {
  if (provider === 'google') return 'https://accounts.google.com/o/oauth2/v2/auth';
  const tenant = repo.getSetting('auth.sso.entra.tenant') || 'common';
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`;
}

function providerClientId(provider: ExternalSignOnProvider) {
  return provider === 'google'
    ? repo.getSetting('auth.sso.google.clientId')
    : repo.getSetting('auth.sso.entra.clientId');
}

export function createExternalSignOnAuthorizationUrl(input: ExternalSignOnAuthorizationInput) {
  const clientId = providerClientId(input.provider);
  if (!clientId) throw new Error('Enter provider settings before connecting sign-on.');
  if (!getExternalSignOnClientSecret(input.provider)) {
    throw new Error('Enter the provider client secret before connecting sign-on.');
  }

  const url = new URL(providerAuthorizeEndpoint(input.provider));
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', externalSignOnRedirectUri(input.origin, input.provider));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', input.state);
  url.searchParams.set('nonce', input.nonce);
  url.searchParams.set('code_challenge', input.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- tests/external-sign-on.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/external-sign-on.ts tests/external-sign-on.test.ts
git commit -m "feat: create external sign-on authorization requests"
```

---

### Task 4: Add State, Nonce, And PKCE Cookies

**Files:**
- Modify: `src/lib/server/external-sign-on.ts`
- Test: `tests/external-sign-on.test.ts`

- [ ] **Step 1: Add failing transient-cookie tests**

Append to `tests/external-sign-on.test.ts`:

```ts
describe('external sign-on transient cookies', () => {
  it('stores and consumes state, nonce, verifier, mode, and provider', async () => {
    const values = new Map<string, string>();
    const cookies = {
      set: (name: string, value: string) => values.set(name, value),
      get: (name: string) => values.get(name),
      delete: (name: string) => values.delete(name)
    };
    const { consumeExternalSignOnRequest, storeExternalSignOnRequest } =
      await import('../src/lib/server/external-sign-on');

    storeExternalSignOnRequest(cookies as never, {
      provider: 'google',
      mode: 'link',
      state: 'state-value',
      nonce: 'nonce-value',
      codeVerifier: 'verifier-value'
    });

    expect(consumeExternalSignOnRequest(cookies as never, 'google')).toEqual({
      provider: 'google',
      mode: 'link',
      state: 'state-value',
      nonce: 'nonce-value',
      codeVerifier: 'verifier-value'
    });
    expect(values.size).toBe(0);
  });

  it('creates a SHA-256 PKCE challenge from a verifier', async () => {
    const { pkceChallenge } = await import('../src/lib/server/external-sign-on');

    expect(pkceChallenge('verifier-value')).toBe('TOz9tElKFl_BCn5f-hRiamC0uxUtV6MtrBbYULXDpXs');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/external-sign-on.test.ts
```

Expected: FAIL because cookie helpers are missing.

- [ ] **Step 3: Implement transient-cookie helpers**

Add to `src/lib/server/external-sign-on.ts`:

```ts
type ExternalSignOnRequest = {
  provider: ExternalSignOnProvider;
  mode: ExternalSignOnMode;
  state: string;
  nonce: string;
  codeVerifier: string;
};

const requestCookieNames = {
  provider: 'tcs_sso_provider',
  mode: 'tcs_sso_mode',
  state: 'tcs_sso_state',
  nonce: 'tcs_sso_nonce',
  codeVerifier: 'tcs_sso_code_verifier'
};

const transientCookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 10 * 60
};

export function storeExternalSignOnRequest(cookies: Cookies, request: ExternalSignOnRequest) {
  cookies.set(requestCookieNames.provider, request.provider, transientCookieOptions);
  cookies.set(requestCookieNames.mode, request.mode, transientCookieOptions);
  cookies.set(requestCookieNames.state, request.state, transientCookieOptions);
  cookies.set(requestCookieNames.nonce, request.nonce, transientCookieOptions);
  cookies.set(requestCookieNames.codeVerifier, request.codeVerifier, transientCookieOptions);
}

export function consumeExternalSignOnRequest(cookies: Cookies, provider: ExternalSignOnProvider) {
  const request = {
    provider: cookies.get(requestCookieNames.provider),
    mode: cookies.get(requestCookieNames.mode),
    state: cookies.get(requestCookieNames.state),
    nonce: cookies.get(requestCookieNames.nonce),
    codeVerifier: cookies.get(requestCookieNames.codeVerifier)
  };

  for (const name of Object.values(requestCookieNames)) {
    cookies.delete(name, { path: '/' });
  }

  if (
    request.provider !== provider ||
    (request.mode !== 'login' && request.mode !== 'link') ||
    !request.state ||
    !request.nonce ||
    !request.codeVerifier
  ) {
    throw new Error('The sign-on request expired. Start again.');
  }

  return request as ExternalSignOnRequest;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- tests/external-sign-on.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/external-sign-on.ts tests/external-sign-on.test.ts
git commit -m "feat: store external sign-on request state"
```

---

### Task 5: Add Callback Validation And Linked Identity Persistence

**Files:**
- Modify: `src/lib/server/external-sign-on.ts`
- Test: `tests/external-sign-on.test.ts`

- [ ] **Step 1: Add failing callback tests with mocked OIDC exchange**

Append to `tests/external-sign-on.test.ts`:

```ts
describe('external sign-on callback handling', () => {
  beforeEach(async () => {
    const { repo } = await import('../src/lib/server/repository/index');
    repo.__clear();
  });

  it('links exactly one external identity from verified claims', async () => {
    const { getExternalSignOnStatus, linkExternalSignOnIdentity } =
      await import('../src/lib/server/external-sign-on');

    linkExternalSignOnIdentity('google', {
      sub: 'google-sub',
      email: 'owner@example.com',
      name: 'Owner Example'
    });

    expect(getExternalSignOnStatus()).toMatchObject({
      enabled: true,
      provider: 'google',
      email: 'owner@example.com',
      name: 'Owner Example'
    });
  });

  it('accepts only the exact linked provider and subject for login', async () => {
    const { assertExternalSignOnIdentityMatches, linkExternalSignOnIdentity } =
      await import('../src/lib/server/external-sign-on');

    linkExternalSignOnIdentity('entra', {
      sub: 'entra-sub',
      email: 'owner@example.com',
      name: 'Owner Example'
    });

    expect(() =>
      assertExternalSignOnIdentityMatches('entra', {
        sub: 'entra-sub',
        email: 'owner@example.com',
        name: 'Owner Example'
      })
    ).not.toThrow();

    expect(() =>
      assertExternalSignOnIdentityMatches('google', {
        sub: 'entra-sub',
        email: 'owner@example.com',
        name: 'Owner Example'
      })
    ).toThrow('That account is not linked to this app.');
  });

  it('removes linked identity without removing provider configuration', async () => {
    const { clearExternalSignOnIdentity, getExternalSignOnStatus, linkExternalSignOnIdentity, updateExternalSignOnProviderSettings } =
      await import('../src/lib/server/external-sign-on');

    updateExternalSignOnProviderSettings({
      provider: 'google',
      googleClientId: 'google-client',
      googleClientSecret: 'google-secret',
      entraTenant: '',
      entraClientId: '',
      entraClientSecret: ''
    });
    linkExternalSignOnIdentity('google', {
      sub: 'google-sub',
      email: 'owner@example.com',
      name: 'Owner Example'
    });

    clearExternalSignOnIdentity();

    expect(getExternalSignOnStatus()).toMatchObject({
      enabled: false,
      provider: 'google',
      googleClientId: 'google-client',
      googleClientSecretConfigured: true
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/external-sign-on.test.ts
```

Expected: FAIL because identity helpers are missing.

- [ ] **Step 3: Implement identity helpers**

Add to `src/lib/server/external-sign-on.ts`:

```ts
export type ExternalSignOnClaims = {
  sub: string;
  email?: string;
  name?: string;
};

export function linkExternalSignOnIdentity(provider: ExternalSignOnProvider, claims: ExternalSignOnClaims) {
  if (!claims.sub) throw new Error('The provider did not return an account identifier.');
  repo.setSetting('auth.sso.provider', provider);
  repo.setSetting('auth.sso.subject', claims.sub);
  repo.setSetting('auth.sso.email', claims.email ?? '');
  repo.setSetting('auth.sso.name', claims.name ?? '');
  repo.setSetting('auth.sso.linkedAt', new Date().toISOString());
}

export function assertExternalSignOnIdentityMatches(provider: ExternalSignOnProvider, claims: ExternalSignOnClaims) {
  const status = getExternalSignOnStatus();
  const storedSubject = repo.getSetting('auth.sso.subject');
  if (!status.enabled || status.provider !== provider || !claims.sub || storedSubject !== claims.sub) {
    throw new Error('That account is not linked to this app.');
  }
}

export function clearExternalSignOnIdentity() {
  repo.deleteSetting('auth.sso.subject');
  repo.deleteSetting('auth.sso.email');
  repo.deleteSetting('auth.sso.name');
  repo.deleteSetting('auth.sso.linkedAt');
}
```

- [ ] **Step 4: Add OIDC callback exchange seam**

Add this shape to `src/lib/server/external-sign-on.ts`; adapt exact calls to the installed `openid-client` API after checking its versioned docs/types:

```ts
export type ExternalSignOnCallbackInput = {
  origin: string;
  provider: ExternalSignOnProvider;
  code: string;
  codeVerifier: string;
  nonce: string;
};

export async function exchangeExternalSignOnCode(input: ExternalSignOnCallbackInput): Promise<ExternalSignOnClaims> {
  throw new Error('OIDC exchange is implemented in the dependency integration step.');
}
```

Do not hand-roll ID token validation. The final implementation of this function must use the OIDC dependency for discovery, token exchange, signature validation, issuer validation, audience validation, expiration validation, and nonce validation.

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
npm test -- tests/external-sign-on.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/external-sign-on.ts tests/external-sign-on.test.ts
git commit -m "feat: manage linked external sign-on identity"
```

---

### Task 6: Implement Real OIDC Exchange

**Files:**
- Modify: `src/lib/server/external-sign-on.ts`
- Test: `tests/external-sign-on.test.ts`

- [ ] **Step 1: Add dependency-injection test for callback exchange**

Add a small exported dependency setter in `src/lib/server/external-sign-on.ts` before writing the test:

```ts
type OidcAdapter = {
  exchange: (input: ExternalSignOnCallbackInput & { clientId: string; clientSecret: string; redirectUri: string }) => Promise<ExternalSignOnClaims>;
};

let oidcAdapter: OidcAdapter | undefined;

export function setExternalSignOnOidcAdapterForTests(adapter: OidcAdapter | undefined) {
  oidcAdapter = adapter;
}
```

Append to `tests/external-sign-on.test.ts`:

```ts
describe('external sign-on OIDC exchange', () => {
  beforeEach(async () => {
    const { repo } = await import('../src/lib/server/repository/index');
    repo.__clear();
  });

  it('passes provider credentials and redirect URI to the OIDC adapter', async () => {
    const {
      exchangeExternalSignOnCode,
      setExternalSignOnOidcAdapterForTests,
      updateExternalSignOnProviderSettings
    } = await import('../src/lib/server/external-sign-on');
    const exchange = vi.fn(async () => ({ sub: 'sub', email: 'owner@example.com', name: 'Owner' }));

    updateExternalSignOnProviderSettings({
      provider: 'google',
      googleClientId: 'google-client',
      googleClientSecret: 'google-secret',
      entraTenant: '',
      entraClientId: '',
      entraClientSecret: ''
    });
    setExternalSignOnOidcAdapterForTests({ exchange });

    await expect(
      exchangeExternalSignOnCode({
        origin: 'https://app.example.com',
        provider: 'google',
        code: 'code',
        codeVerifier: 'verifier',
        nonce: 'nonce'
      })
    ).resolves.toEqual({ sub: 'sub', email: 'owner@example.com', name: 'Owner' });

    expect(exchange).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'google-client',
        clientSecret: 'google-secret',
        redirectUri: 'https://app.example.com/auth/external/google/callback'
      })
    );
    setExternalSignOnOidcAdapterForTests(undefined);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/external-sign-on.test.ts
```

Expected: FAIL until `exchangeExternalSignOnCode` uses the adapter.

- [ ] **Step 3: Implement adapter-backed exchange and real default adapter**

Update `exchangeExternalSignOnCode` in `src/lib/server/external-sign-on.ts`:

```ts
export async function exchangeExternalSignOnCode(input: ExternalSignOnCallbackInput): Promise<ExternalSignOnClaims> {
  const clientId = providerClientId(input.provider);
  const clientSecret = getExternalSignOnClientSecret(input.provider);
  if (!clientId || !clientSecret) throw new Error('External sign-on provider settings are incomplete.');

  const adapter = oidcAdapter ?? defaultOidcAdapter;
  const claims = await adapter.exchange({
    ...input,
    clientId,
    clientSecret,
    redirectUri: externalSignOnRedirectUri(input.origin, input.provider)
  });

  if (!claims.sub) throw new Error('The provider did not return an account identifier.');
  return claims;
}
```

Implement `defaultOidcAdapter` using the installed `openid-client` API. The code must:

- Discover issuer metadata for Google or Entra.
- Exchange the authorization code with client ID, client secret, redirect URI, and code verifier.
- Validate nonce through the library.
- Return only `{ sub, email, name }`.

If the installed library API differs from examples, inspect the installed package types under `node_modules/openid-client` and adapt to those exported functions. Do not bypass ID token signature or claim validation.

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm test -- tests/external-sign-on.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run TypeScript check**

Run:

```bash
npm run check
```

Expected: PASS with 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/external-sign-on.ts tests/external-sign-on.test.ts package.json package-lock.json
git commit -m "feat: exchange external sign-on callbacks"
```

---

### Task 7: Add Login And Link Routes

**Files:**
- Create: `src/routes/auth/external/[provider]/start/+server.ts`
- Create: `src/routes/auth/external/[provider]/callback/+server.ts`
- Modify: `src/lib/server/external-sign-on.ts`
- Test: `tests/external-sign-on-routes.test.ts`

- [ ] **Step 1: Add route tests for start and callback decisions**

Create `tests/external-sign-on-routes.test.ts` with tests that import route handlers directly, mock `external-sign-on.ts` helpers where needed, and verify:

```ts
import { describe, expect, it, vi } from 'vitest';

describe('external sign-on routes', () => {
  it('rejects unknown providers', async () => {
    const { GET } = await import('../src/routes/auth/external/[provider]/start/+server');

    await expect(
      GET({
        params: { provider: 'github' },
        url: new URL('https://app.example.com/auth/external/github/start'),
        cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() }
      } as never)
    ).rejects.toMatchObject({ status: 303 });
  });
});
```

Expand this file after the route handlers exist to cover:

- `mode=login` stores transient request cookies and redirects to the provider URL.
- `mode=link` stores transient request cookies and redirects to the provider URL.
- callback with mismatched state redirects to `/login?error=external`.
- login callback with matching identity calls `createSession`.
- link callback stores the linked identity and redirects to `/settings?section=security`.

- [ ] **Step 2: Run the route test to verify it fails**

Run:

```bash
npm test -- tests/external-sign-on-routes.test.ts
```

Expected: FAIL because the route files do not exist.

- [ ] **Step 3: Implement start route**

Create `src/routes/auth/external/[provider]/start/+server.ts`:

```ts
import { redirect } from '@sveltejs/kit';
import {
  createExternalSignOnAuthorizationUrl,
  isExternalSignOnProvider,
  pkceChallenge,
  randomUrlToken,
  storeExternalSignOnRequest,
  type ExternalSignOnMode
} from '$lib/server/external-sign-on';

export function GET({ cookies, params, url }) {
  if (!isExternalSignOnProvider(params.provider)) throw redirect(303, '/login?error=external');

  const mode = url.searchParams.get('mode') === 'link' ? 'link' : 'login';
  const state = randomUrlToken();
  const nonce = randomUrlToken();
  const codeVerifier = randomUrlToken();
  const codeChallenge = pkceChallenge(codeVerifier);

  storeExternalSignOnRequest(cookies, {
    provider: params.provider,
    mode: mode as ExternalSignOnMode,
    state,
    nonce,
    codeVerifier
  });

  throw redirect(
    303,
    createExternalSignOnAuthorizationUrl({
      origin: url.origin,
      provider: params.provider,
      mode,
      state,
      nonce,
      codeChallenge
    }).toString()
  );
}
```

- [ ] **Step 4: Implement callback route**

Create `src/routes/auth/external/[provider]/callback/+server.ts`:

```ts
import { redirect } from '@sveltejs/kit';
import { createSession } from '$lib/server/auth';
import {
  assertExternalSignOnIdentityMatches,
  consumeExternalSignOnRequest,
  exchangeExternalSignOnCode,
  isExternalSignOnProvider,
  linkExternalSignOnIdentity
} from '$lib/server/external-sign-on';

export async function GET({ cookies, params, url }) {
  if (!isExternalSignOnProvider(params.provider)) throw redirect(303, '/login?error=external');

  try {
    const request = consumeExternalSignOnRequest(cookies, params.provider);
    if (url.searchParams.get('state') !== request.state) {
      throw new Error('The sign-on response did not match the started request.');
    }

    const code = url.searchParams.get('code');
    if (!code) throw new Error('The provider did not return a sign-on code.');

    const claims = await exchangeExternalSignOnCode({
      origin: url.origin,
      provider: params.provider,
      code,
      codeVerifier: request.codeVerifier,
      nonce: request.nonce
    });

    if (request.mode === 'link') {
      linkExternalSignOnIdentity(params.provider, claims);
      throw redirect(303, '/settings?section=security&externalSignOn=linked');
    }

    assertExternalSignOnIdentityMatches(params.provider, claims);
    createSession(cookies);
    throw redirect(303, '/');
  } catch {
    throw redirect(303, '/login?error=external');
  }
}
```

- [ ] **Step 5: Run route tests and check**

Run:

```bash
npm test -- tests/external-sign-on-routes.test.ts tests/external-sign-on.test.ts
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/auth/external/[provider]/start/+server.ts src/routes/auth/external/[provider]/callback/+server.ts src/lib/server/external-sign-on.ts tests/external-sign-on-routes.test.ts tests/external-sign-on.test.ts
git commit -m "feat: add external sign-on routes"
```

---

### Task 8: Add Settings Security UI And Actions

**Files:**
- Modify: `src/routes/settings/+page.server.ts`
- Modify: `src/routes/settings/+page.svelte`
- Modify: `src/lib/server/settings.ts`
- Test: `tests/external-sign-on-routes.test.ts`
- Test: existing settings/UI contract tests if they cover settings sections

- [ ] **Step 1: Add failing settings action tests**

In `tests/external-sign-on-routes.test.ts`, add tests for settings actions:

```ts
describe('settings external sign-on actions', () => {
  it('requires the local admin password before removing linked sign-on', async () => {
    const page = await import('../src/routes/settings/+page.server');
    const result = await page.actions.removeExternalSignOn({
      request: new Request('https://app.example.com/settings', {
        method: 'POST',
        body: new URLSearchParams({ currentPassword: 'wrong' })
      })
    } as never);

    expect(JSON.stringify(result).toLowerCase()).toContain('password');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/external-sign-on-routes.test.ts
```

Expected: FAIL because actions are not added yet.

- [ ] **Step 3: Extend settings load data**

Modify `src/routes/settings/+page.server.ts` load to include:

```ts
import { externalSignOnRedirectUri, getExternalSignOnStatus } from '$lib/server/external-sign-on';

externalSignOn: getExternalSignOnStatus(),
externalSignOnRedirectUris: {
  google: externalSignOnRedirectUri(url.origin, 'google'),
  entra: externalSignOnRedirectUri(url.origin, 'entra')
}
```

- [ ] **Step 4: Add settings actions**

In `src/routes/settings/+page.server.ts`, add actions that:

- Save provider fields through `updateExternalSignOnProviderSettings`.
- Confirm `currentPassword` with `verifyAdminPassword`.
- Redirect to `/auth/external/<provider>/start?mode=link` to connect.
- Remove linked identity with `clearExternalSignOnIdentity`.

Use action names:

```ts
saveExternalSignOnProvider
connectExternalSignOn
removeExternalSignOn
```

Keep these separate from existing SMTP, AI, scheduler, remote, vocabulary, and password actions.

- [ ] **Step 5: Add settings UI**

Modify `src/routes/settings/+page.svelte` inside the existing Security section. Add:

- Provider radio buttons for Google and Microsoft Entra ID.
- A read-only redirect address field that changes based on selected provider.
- Provider credential fields.
- A local admin password confirmation field for connect/remove.
- A linked identity summary when configured.
- A remove button when configured.

Visible helper copy must use plain language:

```svelte
<p class="hint">
  External sign-on is optional. Password login stays available, and you will need the password to change or remove this connection.
</p>
<p class="hint">
  Copy this redirect address into your Google or Microsoft app setup, then paste the IDs and secret from that setup here.
</p>
```

Do not use wording that implies the reader is not technical enough.

- [ ] **Step 6: Run tests and check**

Run:

```bash
npm test -- tests/external-sign-on-routes.test.ts tests/external-sign-on.test.ts
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/settings/+page.server.ts src/routes/settings/+page.svelte src/lib/server/settings.ts tests/external-sign-on-routes.test.ts
git commit -m "feat: add external sign-on settings controls"
```

---

### Task 9: Add Login Page External Sign-On Entry Point

**Files:**
- Modify: `src/routes/login/+page.server.ts`
- Modify: `src/routes/login/+page.svelte`
- Test: `tests/external-sign-on-routes.test.ts`

- [ ] **Step 1: Add failing login visibility tests**

Add tests that verify login load returns no external sign-on option when unlinked and returns one option when linked:

```ts
describe('login external sign-on visibility', () => {
  it('does not show external sign-on before an identity is linked', async () => {
    const page = await import('../src/routes/login/+page.server');
    const data = await page.load({ url: new URL('https://app.example.com/login') } as never);

    expect(data.externalSignOn?.enabled).toBe(false);
  });
});
```

Add a second test that seeds linked settings and expects provider label and start URL.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/external-sign-on-routes.test.ts
```

Expected: FAIL until login load data is extended.

- [ ] **Step 3: Extend login load data**

Modify `src/routes/login/+page.server.ts`:

```ts
import { getExternalSignOnStatus } from '$lib/server/external-sign-on';

export function load({ url }) {
  return {
    externalSignOn: getExternalSignOnStatus(),
    externalError: url.searchParams.get('error') === 'external'
  };
}
```

Merge this with any existing login load data instead of replacing it.

- [ ] **Step 4: Add login button and generic error copy**

Modify `src/routes/login/+page.svelte`:

```svelte
{#if data.externalError}
  <p class="error">That account is not linked to this app.</p>
{/if}

{#if data.externalSignOn.enabled}
  <a class="button secondary" href={`/auth/external/${data.externalSignOn.provider}/start?mode=login`}>
    Sign in with {data.externalSignOn.providerLabel}
  </a>
{/if}
```

Match existing class names and layout in the login page. Keep password login visible above or beside the external sign-on option.

- [ ] **Step 5: Run focused tests and check**

Run:

```bash
npm test -- tests/external-sign-on-routes.test.ts tests/auth-routing.test.ts
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/login/+page.server.ts src/routes/login/+page.svelte tests/external-sign-on-routes.test.ts
git commit -m "feat: show linked external sign-on on login"
```

---

### Task 10: Add User Documentation And Helper Material

**Files:**
- Modify: `README.md`
- Create: `docs/EXTERNAL-SIGN-ON.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/OPEN-SOURCE-READINESS.md`

- [ ] **Step 1: Write the helper guide**

Create `docs/EXTERNAL-SIGN-ON.md` with:

```md
# External Sign-On

External sign-on lets the owner of one app installation sign in with either Google or Microsoft Entra ID. It is optional. Password login always stays available.

This app does not provide a hosted sign-on service or shared provider credentials. You create your own Google or Microsoft app registration and paste the values into Settings.

## Before You Start

You need:

- The app running and reachable in your browser.
- The local admin password for this app.
- Access to create an app registration in Google Cloud or Microsoft Entra ID.

Open **Settings**, then **Security**, then **External sign-on**. Choose Google or Microsoft Entra ID. The app will show a redirect address. Copy that exact address into the provider setup.

## Google Setup

1. Go to Google Cloud Console.
2. Create or choose a project.
3. Open OAuth consent and finish the required app information.
4. Create OAuth client credentials for a web application.
5. Add the redirect address shown in this app.
6. Copy the client ID and client secret.
7. Paste them into this app under Settings, Security, External sign-on.
8. Enter the local admin password and connect sign-on.

Use only these scopes:

```text
openid email profile
```

## Microsoft Entra ID Setup

1. Go to the Microsoft Entra admin center.
2. Create an app registration.
3. Add a web redirect URI using the redirect address shown in this app.
4. Create a client secret.
5. Copy the Application ID, Directory/Tenant ID, and client secret.
6. Paste them into this app under Settings, Security, External sign-on.
7. Enter the local admin password and connect sign-on.

Use only these scopes:

```text
openid email profile
```

## Signing In

After sign-on is connected, the login page shows a provider sign-in button. Password login remains available.

## Changing Or Removing Sign-On

Open Settings, Security, External sign-on. Enter the local admin password before replacing or removing the connection.

## Recovery

If the provider app is deleted, the provider secret expires, or the provider account is unavailable, sign in with the local admin password and update or remove external sign-on.
```

- [ ] **Step 2: Update README**

Add a short user-facing section near the login/security guidance:

```md
### Optional Google or Microsoft Sign-On

Password login is always available. If you want, you can also connect one Google or Microsoft Entra ID account from **Settings > Security** after setup.

You provide your own Google or Microsoft app registration. The app shows the redirect address to copy and asks for the IDs and secret from that provider. See [External Sign-On](docs/EXTERNAL-SIGN-ON.md) for step-by-step help.
```

- [ ] **Step 3: Update architecture docs**

In `docs/ARCHITECTURE.md`, under Authentication And Secrets, add:

```md
Optional external sign-on is single-user sign-on only. It links one provider identity to the installation and then creates the same local session used by password login. It does not add users, roles, teams, account management, or hosted authentication. Provider credentials are installation-owned settings, and sign-on must not store provider access or refresh tokens.
```

- [ ] **Step 4: Update open-source readiness docs**

In `docs/OPEN-SOURCE-READINESS.md`, add:

```md
External sign-on documentation must not imply that the project provides hosted authentication, shared Google credentials, shared Microsoft credentials, or support for private tenant setup. Users who enable sign-on bring their own provider app registration and secrets.
```

- [ ] **Step 5: Run documentation wording scan**

Run:

```bash
rg -n "n[o]rmal users|n[o]rmal humans|i[d]iot|d[u]mmy|s[t]upid|hosted auth service|shared OAuth" README.md docs --glob "!docs/superpowers/**"
```

Expected: no insulting wording. Mentions of "hosted auth service" or "shared OAuth" are acceptable only when clearly saying the app does not provide them.

- [ ] **Step 6: Run check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add README.md docs/EXTERNAL-SIGN-ON.md docs/ARCHITECTURE.md docs/OPEN-SOURCE-READINESS.md
git commit -m "docs: add external sign-on setup guide"
```

---

### Task 11: Final Verification And PR Prep

**Files:**
- Review all changed files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- tests/external-sign-on.test.ts tests/external-sign-on-routes.test.ts tests/auth-routing.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run Svelte/TypeScript check**

Run:

```bash
npm run check
```

Expected: PASS with 0 errors and 0 warnings.

- [ ] **Step 4: Run app build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Run agent gate**

Run:

```bash
npm run agent:check
```

Expected: PASS.

- [ ] **Step 6: Inspect final diff**

Run:

```bash
git status --short
git diff --stat main...HEAD
git diff main...HEAD -- README.md docs/EXTERNAL-SIGN-ON.md docs/ARCHITECTURE.md docs/OPEN-SOURCE-READINESS.md
```

Expected: all changes are intentional, with no runtime data, local paths, secrets, or build output.

- [ ] **Step 7: Push and open PR**

Run:

```bash
git push -u origin HEAD
gh pr create --fill
```

Expected: PR opens against `main`; CI must run before merge.

---

## Self-Review

- Spec coverage: The plan covers optional setup, one linked identity, Google or Entra selection, password-confirmed connect/remove, provider-owned credentials, no stored provider tokens, existing local session creation, login visibility, settings UX, tests, README, helper docs, architecture docs, and open-source readiness docs.
- Placeholder scan: The only intentionally flexible point is adapting the exact `openid-client` calls to the installed versioned API after dependency installation. The plan explicitly requires using the dependency for OIDC validation and forbids hand-rolled token validation.
- Type consistency: Provider values are `google` and `entra` throughout. Settings keys use the `auth.sso.*` namespace throughout. Route paths use `/auth/external/[provider]/start` and `/auth/external/[provider]/callback` throughout.
