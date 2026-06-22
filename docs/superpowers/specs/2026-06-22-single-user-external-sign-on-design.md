# Single-User External Sign-On Design

## Purpose

Training Communications Studio is a single-user, local-first app. External sign-on should make login easier for the owner of an installation without turning the app into a hosted service, account system, multi-user product, or identity broker.

The first supported providers are Google and Microsoft Entra ID. The app will not provide shared OAuth credentials or hosted authentication infrastructure. Each installation that enables external sign-on supplies its own provider configuration.

## Product Rules

- External sign-on is optional.
- The local admin password remains mandatory and continues to be the recovery and control path.
- External sign-on can be enabled only after the local admin password is already configured.
- One installation may link exactly one external identity total.
- The owner chooses either Google or Entra ID for that linked identity.
- Replacing or removing the linked identity requires re-entering the local admin password.
- External sign-on is sign-on only. It does not add users, roles, teams, invites, ownership, or account management.
- Provider access tokens and refresh tokens are not stored for sign-on.

## User Experience

Settings will expose external sign-on under the existing searchable, collapsible Security section.

The Security section will let the owner:

- See whether external sign-on is disabled or linked.
- Pick Google or Entra ID when setting it up.
- Copy the redirect URI that must be entered in the provider's app registration.
- Enter provider credentials in plain-language fields.
- Confirm the local admin password before connecting, replacing, or removing external sign-on.
- Remove the linked sign-on method and fall back to password-only login.

The login page will keep password login available. It will show an external sign-on button only when a linked identity exists.

Provider setup copy should stay non-technical where possible. The app can name the exact values needed, but it should not assume the user knows OAuth vocabulary. For example:

- "Application ID" for Entra client ID.
- "Directory/Tenant ID" for Entra tenant.
- "Client ID" and "Client secret" for Google.
- "Redirect address" for the callback URL to paste into the provider.

## Provider Configuration

Google setup requires:

- Client ID.
- Client secret.
- Redirect URI registered in Google Cloud.
- Scopes: `openid email profile`.

Entra setup requires:

- Tenant ID, tenant domain, or a supported tenant selector.
- Client ID.
- Client secret.
- Redirect URI registered in the app registration.
- Scopes: `openid email profile`.

The app should use the configured public base URL when present so remote installations produce the correct callback address. Local development and local desktop use should fall back to the current app origin.

## Architecture

Add a server-only external sign-on module under `src/lib/server`. It owns provider metadata, authorization URL creation, callback validation, ID token verification, and linked-identity matching.

Routes remain thin:

- Settings actions validate form input, confirm the admin password, persist provider configuration, and start linking.
- Login start routes create a provider authorization request.
- Callback routes validate the provider response and either link the identity or create the normal local session.

The existing local session system remains the only app session system. A successful external sign-on creates the same kind of session as password login.

## Data Model

External sign-on state can live in settings because this is a single-user installation-level feature.

Store:

- Selected provider: `google` or `entra`.
- Linked provider subject (`sub` claim).
- Linked email address for display.
- Optional linked display name.
- Linked timestamp.
- Provider client ID.
- Encrypted provider client secret.
- Entra tenant value when Entra is selected.

Do not store:

- Provider access tokens.
- Provider refresh tokens.
- Raw ID tokens.
- Provider profile JSON.

Secrets must use the existing encrypted settings pattern. Blank secret fields in settings should preserve the existing encrypted value.

## Security Model

The app trusts an external provider only to prove that the browser session controls the one linked identity. It does not delegate app authorization decisions to the provider.

Required checks:

- Use `state` to protect against callback forgery.
- Use `nonce` to bind the ID token to the started login.
- Use PKCE where supported by the provider flow.
- Validate issuer, audience, expiration, signature, and nonce on ID tokens.
- Match the returned provider and subject exactly against the stored linked identity.
- Fail closed with a generic login error when the identity does not match.
- Never log secrets, authorization codes, tokens, or full ID token payloads.

Changing or removing linked sign-on requires the current local admin password even if the user arrived through external sign-on.

## Implementation Approach

Use a maintained OIDC client library for token exchange, discovery, JWKS retrieval, and ID token validation where it fits SvelteKit server routes cleanly. The app should still own the product rules, settings persistence, linked-identity checks, and local session creation.

This avoids hand-rolling cryptographic validation while keeping the feature local-first and provider-neutral.

## Alternatives Considered

Direct provider implementation would keep dependencies lower, but it would require custom OIDC discovery, JWKS caching, token exchange, and ID token validation code. That is avoidable security-sensitive work.

Reverse-proxy authentication would avoid OAuth code in the app, but it would not satisfy the simple in-app setup goal and would push the hard part onto the user.

Hosted auth or shared OAuth credentials are out of scope because this is an open-source local app and we are not providing a service.

## Error Handling

Settings should surface actionable setup errors, such as missing client ID, missing secret, invalid tenant, provider callback failure, or identity mismatch during linking.

Login should avoid leaking sensitive detail. For user-facing login failures, prefer a short message such as "That account is not linked to this app." Detailed provider diagnostics should be reserved for settings setup flows and should never include secrets or tokens.

If provider configuration is incomplete, the external sign-on button should not appear on the login page.

## Tests

Add focused tests for:

- External sign-on settings validation.
- Password confirmation before connect, replace, or remove.
- Authorization URL generation with state, nonce, scopes, and redirect URI.
- Callback rejection for bad state, bad nonce, bad issuer, bad audience, expired token, or identity mismatch.
- Successful callback creating the existing local session type.
- Login page visibility rules for password-only and linked-sign-on states.
- Secret update behavior where blank secret input preserves the stored secret.

Provider network calls should be mocked in tests. Tests must not require real Google or Entra credentials.

## Documentation

Update user-facing docs after implementation:

- README install/use guidance should explain that password login is always available and external sign-on is optional.
- Settings/Security docs should explain Google and Entra setup in plain language.
- Architecture docs should state that external sign-on is single-user sign-on only and not account management.
- Open-source docs should make clear that users bring their own provider credentials.

## Out Of Scope

- Multi-user support.
- Role-based access control.
- User invitations.
- Hosted auth services.
- Shared provider credentials.
- Storing refresh tokens for sign-on.
- Using external sign-on for SMTP authorization.
- Agent-specific identity or agent-specific database permissions.
