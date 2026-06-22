# External Sign-On

External sign-on lets the owner of one Training Communications Studio
installation sign in with either Google or Microsoft Entra ID.

External sign-on is optional. Password login always remains available, and you
still need the local admin password for setup, recovery, changing the
connection, and removing the connection.

The app does not provide hosted sign-on, shared Google credentials, or shared
Microsoft credentials. If you enable external sign-on, you create and own the
provider app registration and secrets for your installation.

## Before You Start

You need:

- The app running and reachable at the address you use in your browser.
- The local admin password for this installation.
- Access to create an app registration in Google Cloud Console or Microsoft
  Entra admin center.

Open **Settings**, then **Security**, then **External sign-on**. Choose Google
or Microsoft Entra ID. The app shows a redirect address for that provider. Copy
that exact address into the provider setup.

## Google Setup

1. Open Google Cloud Console.
2. Choose or create the Google Cloud project you want to use for this app.
3. Open the OAuth consent screen and complete the required app information.
4. Create OAuth client credentials for a web application.
5. Add the redirect address from **Settings > Security > External sign-on** as
   an authorized redirect URI.
6. Use these scopes: `openid`, `email`, and `profile`.
7. Copy the Google client ID and client secret.
8. Paste the client ID and client secret into **Settings > Security > External
   sign-on**.
9. Enter the local admin password and choose **Connect external sign-on**.

After the provider sign-in finishes, the app links the Google account that
completed the setup. Only that linked identity can use Google sign-on for this
installation.

## Microsoft Entra ID Setup

1. Open Microsoft Entra admin center.
2. Create an app registration for this installation.
3. Add a web redirect URI that exactly matches the redirect address from
   **Settings > Security > External sign-on**.
4. Create a client secret and copy the secret value before leaving the Entra
   screen.
5. Copy the Application (client) ID.
6. Copy the Directory (tenant) ID. Use the tenant ID shown for the app
   registration, or use `common` only when you intentionally want the Microsoft
   common endpoint.
7. Use these scopes: `openid`, `email`, and `profile`.
8. Paste the Application ID, tenant ID, and client secret into **Settings >
   Security > External sign-on**.
9. Enter the local admin password and choose **Connect external sign-on**.

After the provider sign-in finishes, the app links the Microsoft identity that
completed the setup. Only that linked identity can use Microsoft Entra ID
sign-on for this installation.

## Signing In

After external sign-on is connected, the login page shows a provider sign-in
button. Password login remains available on the same page.

Successful external sign-on creates the same local app session as password
login. It does not add users, roles, teams, invites, or account management.

## Changing Or Removing Sign-On

Open **Settings > Security > External sign-on**.

To replace the provider settings or link a different provider identity, paste
the new provider values, enter the local admin password, and connect external
sign-on again.

To remove the connection, enter the local admin password and choose **Remove
external sign-on**. Password login remains available after removal.

## Recovery

If the provider app is deleted, the provider secret expires, the provider
account becomes unavailable, or provider sign-in fails, use the local admin
password to sign in. Then open **Settings > Security > External sign-on** and
update or remove the connection.

Keep the local admin password in a safe place. External sign-on is a convenience
for one installation; it is not a replacement for the local recovery path.
