<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
  let smtpAuthMethod = $state('');
  let smtpHost = $state('');
  let smtpPort = $state('');
  let smtpUser = $state('');
  let smtpFrom = $state('');
  let microsoftTenantId = $state('');
  let initialized = $state(false);
  let aiBaseUrl = $state('');
  let selectedAiModel = $state('');
  let replySyncHost = $state('');
  let replySyncPort = $state('');
  let replySyncTls = $state(true);
  let replySyncUsername = $state('');
  let externalSignOnProvider = $state('google');
  let settingsSearch = $state('');

  $effect(() => {
    if (!initialized) {
      smtpAuthMethod = data.settings.smtpAuthMethod;
      smtpHost = data.settings.smtpHost;
      smtpPort = data.settings.smtpPort;
      smtpUser = data.settings.smtpUser;
      smtpFrom = data.settings.smtpFrom;
      microsoftTenantId = data.settings.microsoftTenantId;
      aiBaseUrl = form?.aiBaseUrl || data.settings.aiBaseUrl;
      selectedAiModel = form?.aiModel || data.settings.aiModel;
      replySyncHost = data.settings.replySyncHost;
      replySyncPort = data.settings.replySyncPort;
      replySyncTls = data.settings.replySyncTls;
      replySyncUsername = data.settings.replySyncUsername;
      externalSignOnProvider = data.externalSignOn.provider || 'google';
      initialized = true;
    }
  });

  function applySmtpPreset(provider: 'gmail' | 'fastmail' | 'outlook') {
    if (provider === 'gmail') {
      smtpAuthMethod = 'password';
      smtpHost = 'smtp.gmail.com';
      smtpPort = '465';
    } else if (provider === 'fastmail') {
      smtpAuthMethod = 'password';
      smtpHost = 'smtp.fastmail.com';
      smtpPort = '465';
    } else {
      smtpAuthMethod = 'microsoft-oauth2';
      smtpHost = 'smtp.office365.com';
      smtpPort = '587';
      microsoftTenantId ||= 'common';
    }
  }

  function applyImapPreset(provider: 'gmail' | 'fastmail' | 'outlook') {
    replySyncTls = true;
    replySyncPort = '993';
    if (provider === 'gmail') replySyncHost = 'imap.gmail.com';
    if (provider === 'fastmail') replySyncHost = 'imap.fastmail.com';
    if (provider === 'outlook') replySyncHost = 'outlook.office365.com';
  }

  function noticeClass(message: string) {
    return message.includes('accepted') || message.includes('connected') || message.includes('saved') || message.includes('updated') || message.includes('removed')
      ? 'success spaced'
      : 'error spaced';
  }

  function sectionMatches(title: string, terms: string[]) {
    const query = settingsSearch.trim().toLowerCase();
    if (!query) return true;
    return [title, ...terms].join(' ').toLowerCase().includes(query);
  }

  function externalSignOnRedirectUri() {
    return externalSignOnProvider === 'entra'
      ? data.externalSignOnRedirectUris.entra
      : data.externalSignOnRedirectUris.google;
  }
</script>

<svelte:head>
  <title>Settings · Training Communications Studio</title>
</svelte:head>

<section class="band settings-page">
  <div class="settings-intro">
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">Settings</p>
        <h2>Local service, SMTP, AI, and remote access</h2>
      </div>
    </div>
    <p class="body-copy">Remote access is provider-neutral. Use these settings with Cloudflare Tunnel, Tailscale, or another reverse proxy after setting a strong app secret and admin password.</p>
    {#if form?.message || data.message}<p class={noticeClass(form?.message || data.message)}>{form?.message || data.message}</p>{/if}
    <label class="settings-search">
      Search settings
      <input bind:value={settingsSearch} placeholder="Agent, SMTP, password, schedule" />
    </label>
  </div>

  <div class="settings-grid">
    {#if sectionMatches('Profile and signature', ['identity instructor name email signature template'])}
    <details class="settings-section settings-panel" open>
      <summary>Profile and Signature</summary>
    <form method="POST" action="?/updateProfile" class="panel-form" use:enhance>
      <div>
        <p class="eyebrow">Identity</p>
        <h3>Profile and signature</h3>
      </div>
      <label>
        Instructor name
        <input name="instructorName" value={data.settings.instructorName} />
        <span class="help-text">Used in email templates when you include <code>{'{{instructorName}}'}</code>.</span>
      </label>
      <label>
        Global email signature
        <textarea name="emailSignature" rows="5" placeholder="Your name&#10;Instructor&#10;Phone / website">{data.settings.emailSignature}</textarea>
        <span class="help-text">Automatically appended to every SMTP message. HTML is generated in the background.</span>
      </label>
      <button type="submit">Save profile</button>
    </form>
    </details>
    {/if}

    {#if sectionMatches('Email Sending', ['delivery controls scheduled sending email test mode schedule automation'])}
    <details class="settings-section settings-panel" open>
      <summary>Email Sending</summary>
    <form method="POST" action="?/updateDelivery" class="panel-form" use:enhance>
      <div>
        <p class="eyebrow">Sending</p>
        <h3>Delivery controls</h3>
      </div>
      <div class="toggle-grid">
        <label class="check with-help">
          <span><input name="schedulerEnabled" type="checkbox" checked={data.settings.schedulerEnabled} /> Scheduled sending</span>
          <small>When on, approved scheduled campaigns can send automatically while the app server is running.</small>
        </label>
        <label class="check with-help">
          <span><input name="emailTestModeEnabled" type="checkbox" checked={data.settings.emailTestModeEnabled} /> Email test mode</span>
          <small>Redirects outbound email to the From address and pauses automatic scheduled sends.</small>
        </label>
      </div>
      <button type="submit">Save delivery controls</button>
    </form>
    </details>
    {/if}

    {#if sectionMatches('SMTP and provider authentication', ['smtp email account provider authentication microsoft outlook gmail fastmail password test send'])}
    <details class="settings-section settings-panel wide" open>
      <summary>SMTP and Provider Authentication</summary>
    <form method="POST" action="?/updateSmtp" class="panel-form" use:enhance>
      <div class="panel-title-row">
        <div>
          <p class="eyebrow">Email account</p>
          <h3>SMTP and provider authentication</h3>
        </div>
        {#if data.settings.microsoftRefreshTokenConfigured}<span class="pill good">Outlook connected</span>{/if}
      </div>
      <div class="button-row">
        <button class="secondary" type="button" onclick={() => applySmtpPreset('gmail')}>Gmail preset</button>
        <button class="secondary" type="button" onclick={() => applySmtpPreset('fastmail')}>Fastmail preset</button>
        <button class="secondary" type="button" onclick={() => applySmtpPreset('outlook')}>Outlook OAuth preset</button>
      </div>
      <div class="toggle-grid">
        <label class="check with-help">
          <span><input name="smtpAuthMethod" type="radio" value="password" bind:group={smtpAuthMethod} /> Password / app password</span>
          <small>Use this for Gmail, Fastmail, or custom SMTP providers that support app passwords.</small>
        </label>
        <label class="check with-help">
          <span><input name="smtpAuthMethod" type="radio" value="microsoft-oauth2" bind:group={smtpAuthMethod} /> Microsoft OAuth2</span>
          <small>Use Microsoft sign-in for Outlook or Microsoft 365 SMTP. No app password is used.</small>
        </label>
      </div>
      <div class="split">
        <label>
          Host
          <input name="smtpHost" bind:value={smtpHost} />
          <span class="help-text">The outgoing mail server from your email provider, for example <code>smtp.gmail.com</code>.</span>
        </label>
        <label>
          Port
          <input name="smtpPort" bind:value={smtpPort} />
          <span class="help-text">Usually 587. Use 465 only if your provider says to use SSL SMTP.</span>
        </label>
      </div>
      <div class="split">
        <label>
          Username
          <input name="smtpUser" bind:value={smtpUser} />
          <span class="help-text">Often your full email address. Some providers let this stay blank.</span>
        </label>
        <label>
          From address
          <input name="smtpFrom" bind:value={smtpFrom} />
          <span class="help-text">The email address students will see as the sender.</span>
        </label>
      </div>
      {#if smtpAuthMethod === 'password'}
        <label>
          Password
          <input name="smtpPassword" type="password" placeholder={data.settings.smtpPasswordConfigured ? 'Configured' : ''} />
          <span class="help-text">Use an app password if your email provider offers one. Leave blank to keep the current saved password.</span>
        </label>
      {:else}
        <section class="stack">
          <h3>Microsoft OAuth2</h3>
          <div class="setup-note">
            <p class="help-text">Create a Microsoft Entra app registration before connecting Outlook:</p>
            <ol>
              <li>In Microsoft Entra admin center, create an app registration named <strong>Training Communications Studio</strong>.</li>
              <li>Set supported account types to the accounts you want to use. Use personal Microsoft accounts if you send from Outlook.com.</li>
              <li>Add a web redirect URI exactly matching <code>{data.microsoftRedirectUri}</code>.</li>
              <li>Create a client secret and paste its value below before it expires from the Entra screen.</li>
              <li>Under API permissions, add delegated permission <code>Office 365 Exchange Online / SMTP.Send</code>. The sign-in flow will also request <code>offline_access</code>.</li>
            </ol>
          </div>
          <div class="split">
            <label>
              Tenant ID
              <input name="microsoftTenantId" bind:value={microsoftTenantId} placeholder="common" />
              <span class="help-text">Use <code>common</code> for Outlook.com or multi-tenant sign-in, or your Microsoft tenant ID for one organization.</span>
            </label>
            <label>
              Client ID
              <input name="microsoftClientId" value={data.settings.microsoftClientId} />
              <span class="help-text">Application client ID from Microsoft Entra app registration.</span>
            </label>
          </div>
          <label>
            Client secret
            <input name="microsoftClientSecret" type="password" placeholder={data.settings.microsoftClientSecretConfigured ? 'Configured' : ''} />
            <span class="help-text">Leave blank to keep the current saved secret.</span>
          </label>
          <div class="button-row">
            <button type="submit">Save SMTP settings</button>
            <button type="submit" formaction="?/saveAndConnectMicrosoft">Save and connect Outlook</button>
          </div>
        </section>
      {/if}
      {#if smtpAuthMethod === 'password'}<button type="submit">Save SMTP settings</button>{/if}
    </form>
    </details>
    {/if}

    {#if sectionMatches('Remote Access', ['network public base url tunnel cloudflare tailscale proxy secure cookies'])}
    <details class="settings-section settings-panel" open>
      <summary>Remote Access</summary>
    <form method="POST" action="?/updateRemoteAccess" class="panel-form" use:enhance>
      <div>
        <p class="eyebrow">Network</p>
        <h3>Remote access</h3>
      </div>
      <label>
        Public base URL
        <input name="publicBaseUrl" value={data.settings.publicBaseUrl} placeholder="https://mail.example.com" />
        <span class="help-text">Only needed if you open this app from another device or through a tunnel such as Cloudflare. Leave blank for local-only use.</span>
      </label>
      <div class="toggle-grid">
        <label class="check with-help">
          <span><input name="remoteAccessEnabled" type="checkbox" checked={data.settings.remoteAccessEnabled} /> Remote-ready mode</span>
          <small>Use this when exposing the app through a secure tunnel or reverse proxy.</small>
        </label>
        <label class="check with-help">
          <span><input name="trustedProxyEnabled" type="checkbox" checked={data.settings.trustedProxyEnabled} /> Trusted proxy headers</span>
          <small>Turn on only when a trusted service, such as your tunnel, is the only way people can reach the app.</small>
        </label>
      </div>
      <div class="setup-note">
        <p class="help-text">
          Secure cookies are controlled by an environment variable, not this form:
          <code>SCUBA_EMAIL_SECURE_COOKIES=true</code>.
          Set it wherever you start the app when serving through HTTPS, then restart the app.
        </p>
        {#if data.remoteStatus.enabled && data.remoteStatus.blockedReasons.length}
          <ul>
            {#each data.remoteStatus.blockedReasons as reason}
              <li>{reason}</li>
            {/each}
          </ul>
        {:else if data.remoteStatus.enabled}
          <p class="success">Remote access hardening checks are passing.</p>
        {/if}
      </div>
      <button type="submit">Save remote access</button>
    </form>
    </details>
    {/if}

    {#if sectionMatches('Automation', ['optional tools ai endpoint model vision schedule automation local server'])}
    <details class="settings-section settings-panel" open>
      <summary>Automation</summary>
    <form method="POST" action="?/updateAi" class="panel-form" use:enhance>
      <div>
        <p class="eyebrow">Optional tools</p>
        <h3>AI endpoint</h3>
      </div>
      <div class="toggle-grid">
        <label class="check with-help">
          <span><input name="aiEnabled" type="checkbox" checked={data.settings.aiEnabled} /> AI assistance</span>
          <small>Enables template drafting with your local AI endpoint. Email sending still requires your approval.</small>
        </label>
        <label class="check with-help">
          <span><input name="aiVisionEnabled" type="checkbox" checked={data.settings.aiVisionEnabled} /> AI model supports vision</span>
          <small>Turn this on only when the configured AI model can read images. It enables screenshot roster import.</small>
        </label>
      </div>
      <label>
        Base URL
        <input name="aiBaseUrl" bind:value={aiBaseUrl} placeholder="http://localhost:1234/v1" />
        <span class="help-text">The local AI server address. It should look like an OpenAI-compatible <code>/v1</code> endpoint.</span>
      </label>
      {#if form?.aiModels?.length}
        <label>
          Model
          <select name="aiModel" bind:value={selectedAiModel} required>
            <option value="">Choose a model</option>
            {#each form.aiModels as model}
              <option value={model}>{model}</option>
            {/each}
          </select>
          <span class="help-text">Loaded from the configured AI endpoint.</span>
        </label>
      {:else}
        <label>
          Model
          <input name="aiModel" bind:value={selectedAiModel} />
          <span class="help-text">Load models from the endpoint, or enter a model manually if your server does not expose <code>/models</code>.</span>
        </label>
      {/if}
      <label>
        API key
        <input name="aiApiKey" type="password" placeholder={data.settings.aiApiKeyConfigured ? 'Configured' : 'Optional'} />
        <span class="help-text">Usually optional for local AI tools. Leave blank to keep the current saved key.</span>
      </label>
      <div class="button-row">
        <button class="secondary" type="submit" formaction="?/loadAiModels" formnovalidate>Load models</button>
        <button type="submit">Save AI settings</button>
      </div>
    </form>
    </details>
    {/if}

    {#if sectionMatches('Reply Sync', ['imap inbox replies acknowledgements acknowledged polling manual sync email replies'])}
    <details class="settings-section settings-panel" open>
      <summary>Reply Sync</summary>
      <form method="POST" action="?/updateReplySync" class="panel-form" use:enhance>
        <div>
          <p class="eyebrow">Acknowledgements</p>
          <h3>Show replies to sent email</h3>
          <p class="help-text">Connect the inbox for the same address you send from. The app only imports messages that reply to emails it already sent.</p>
        </div>
        <div class="button-row">
          <button class="secondary" type="button" onclick={() => applyImapPreset('gmail')}>Gmail preset</button>
          <button class="secondary" type="button" onclick={() => applyImapPreset('fastmail')}>Fastmail preset</button>
          <button class="secondary" type="button" onclick={() => applyImapPreset('outlook')}>Outlook preset</button>
        </div>
        <div class="split">
          <label>
            Incoming mail server
            <input name="replySyncHost" bind:value={replySyncHost} placeholder="imap.example.com" />
            <span class="help-text">This is the IMAP server from your email provider.</span>
          </label>
          <label>
            Port
            <input name="replySyncPort" bind:value={replySyncPort} />
            <span class="help-text">Usually 993.</span>
          </label>
        </div>
        <label class="check with-help">
          <span><input name="replySyncTls" type="checkbox" bind:checked={replySyncTls} /> Use secure IMAP</span>
          <small>Leave this on unless your email provider gives different instructions.</small>
        </label>
        <label>
          Username
          <input name="replySyncUsername" bind:value={replySyncUsername} />
          <span class="help-text">Usually the same email address used for sending.</span>
        </label>
        <label>
          Password
          <input name="replySyncPassword" type="password" placeholder={data.settings.replySyncPasswordConfigured ? 'Configured' : ''} />
          <span class="help-text">Use an app password if your email provider offers one. Leave blank to keep the current saved password.</span>
        </label>
        <label class="check with-help">
          <span><input name="replySyncPollingEnabled" type="checkbox" checked={data.settings.replySyncPollingEnabled} /> Check for replies automatically</span>
          <small>When on, the app checks the inbox while the server is running. Turn it off to sync only when you click the button below.</small>
        </label>
        <div class="button-row">
          <button type="submit">Save reply sync</button>
          <button class="secondary" type="submit" formaction="?/syncRepliesNow" formnovalidate>Sync replies now</button>
        </div>
      </form>
    </details>
    {/if}

    {#if sectionMatches('Agent Access', ['ai assistant claude code local tools mcp token approval'])}
      <details class="settings-section settings-panel" open>
        <summary>Agent Access</summary>
        <form method="POST" action="?/updateAgentAccess" class="panel-form" use:enhance>
          <label class="check with-help">
            <span><input name="agentEnabled" type="checkbox" checked={data.settings.agentEnabled} /> Enable AI agent access</span>
            <small>Let AI assistants like Claude Code operate this app through approved local tools.</small>
          </label>
          <p class="help-text">Risky actions like sending email still require explicit approval.</p>
          <button type="submit">Save agent access</button>
        </form>
      </details>
    {/if}

    {#if sectionMatches('Agent Permissions', ['view edit import prepare schedule send settings approval workflow risk'])}
      <details class="settings-section settings-panel" open>
        <summary>Agent Permissions</summary>
        <form method="POST" action="?/updateAgentPermissions" class="panel-form" use:enhance>
          <label class="check"><span><input name="viewData" type="checkbox" checked={data.settings.agentPermissions.viewData} /> Let agents view my app data</span></label>
          <label class="check"><span><input name="editRecords" type="checkbox" checked={data.settings.agentPermissions.editRecords} /> Let agents draft and edit records</span></label>
          <label class="check"><span><input name="importData" type="checkbox" checked={data.settings.agentPermissions.importData} /> Let agents import roster data</span></label>
          <label class="check"><span><input name="prepareEmail" type="checkbox" checked={data.settings.agentPermissions.prepareEmail} /> Let agents prepare emails for my approval</span></label>
          <label class="check"><span><input name="scheduleEmail" type="checkbox" checked={data.settings.agentPermissions.scheduleEmail} /> Let agents schedule approved emails</span></label>
          <label class="check"><span><input name="sendEmail" type="checkbox" checked={data.settings.agentPermissions.sendEmail} /> Let agents send approved emails</span></label>
          <label class="check"><span><input name="updateSettings" type="checkbox" checked={data.settings.agentPermissions.updateSettings} /> Let agents update selected settings</span></label>
          <label class="check"><span><input name="manageAgentAccess" type="checkbox" checked={data.settings.agentPermissions.manageAgentAccess} /> Let agents manage agent access</span></label>
          <button type="submit">Save agent permissions</button>
        </form>
      </details>
    {/if}

    {#if sectionMatches('Vocabulary', ['labels course class student instructor participant workshop terminology'])}
      <details class="settings-section settings-panel wide" open>
        <summary>Vocabulary</summary>
        <form method="POST" action="?/updateVocabulary" class="panel-form" use:enhance>
          <div class="split">
            <label>Course type label<input name="courseTypeLabel" value={data.settings.vocabulary.courseTypeLabel} /></label>
            <label>Course types label<input name="courseTypePluralLabel" value={data.settings.vocabulary.courseTypePluralLabel} /></label>
          </div>
          <div class="split">
            <label>Class session label<input name="classSessionLabel" value={data.settings.vocabulary.classSessionLabel} /></label>
            <label>Class sessions label<input name="classSessionPluralLabel" value={data.settings.vocabulary.classSessionPluralLabel} /></label>
          </div>
          <div class="split">
            <label>Student label<input name="studentLabel" value={data.settings.vocabulary.studentLabel} /></label>
            <label>Students label<input name="studentPluralLabel" value={data.settings.vocabulary.studentPluralLabel} /></label>
          </div>
          <div class="split">
            <label>Instructor label<input name="instructorLabel" value={data.settings.vocabulary.instructorLabel} /></label>
            <label>Instructors label<input name="instructorPluralLabel" value={data.settings.vocabulary.instructorPluralLabel} /></label>
          </div>
          <button type="submit">Save vocabulary</button>
        </form>
      </details>
    {/if}

    {#if sectionMatches('Security', ['change admin password app secret login credentials external sign-on sso google microsoft entra identity'])}
    <details class="settings-section settings-panel wide" open={data.openSection === 'security'}>
      <summary>Security</summary>
      <form method="POST" action="?/changePassword" class="panel-form" use:enhance>
        <div>
          <p class="eyebrow">Password login</p>
          <h3>Local admin password</h3>
          <p class="help-text">Password login stays available even when external sign-on is connected. Use a strong local password for setup, recovery, and settings changes.</p>
        </div>
        <label>
          Current password
          <input name="currentPassword" type="password" autocomplete="current-password" />
          <span class="help-text">Required before replacing the local admin password.</span>
        </label>
        <label>
          New password
          <input name="password" type="password" minlength="10" />
          <span class="help-text">Protects the app and student contact details. Use at least 10 characters.</span>
        </label>
        <button type="submit">Update password</button>
      </form>

      <form method="POST" action="?/saveExternalSignOnProvider" class="panel-form external-sign-on-form" use:enhance>
        <div class="panel-title-row">
          <div>
            <p class="eyebrow">External sign-on</p>
            <h3>Google or Microsoft Entra ID</h3>
            <p class="help-text">External sign-on is optional. Connect one provider account to let this single-user app accept that account at login.</p>
          </div>
          {#if data.externalSignOn.enabled}<span class="pill good">Linked</span>{/if}
        </div>

        {#if data.externalSignOnLinked}
          <p class="success">External sign-on is connected. Password login remains available.</p>
        {/if}

        {#if data.externalSignOn.enabled}
          <div class="setup-note">
            <p class="help-text">
              Linked to {data.externalSignOn.providerLabel}
              {#if data.externalSignOn.email} as <strong>{data.externalSignOn.email}</strong>{/if}
              {#if data.externalSignOn.name} ({data.externalSignOn.name}){/if}.
            </p>
            {#if data.externalSignOn.linkedAt}<p class="help-text">Connected at {data.externalSignOn.linkedAt}.</p>{/if}
          </div>
        {:else}
          <div class="setup-note">
            <p class="help-text">No external account is linked yet. Save the provider settings, then connect with your current local admin password.</p>
          </div>
        {/if}

        <div class="toggle-grid">
          <label class="check with-help">
            <span><input name="externalSignOnProvider" type="radio" value="google" bind:group={externalSignOnProvider} /> Google</span>
            <small>Use a Google OAuth client with an authorized redirect URI matching this app.</small>
          </label>
          <label class="check with-help">
            <span><input name="externalSignOnProvider" type="radio" value="entra" bind:group={externalSignOnProvider} /> Microsoft Entra ID</span>
            <small>Use a Microsoft Entra app registration for work, school, or Microsoft accounts.</small>
          </label>
        </div>

        <label>
          Redirect URI
          <input value={externalSignOnRedirectUri()} readonly />
          <span class="help-text">Copy this exact address into the provider app registration before connecting.</span>
        </label>

        {#if externalSignOnProvider === 'google'}
          <div class="split">
            <label>
              Google client ID
              <input name="googleClientId" value={data.externalSignOn.googleClientId} />
              <span class="help-text">OAuth client ID from Google Cloud Console.</span>
            </label>
            <label>
              Google client secret
              <input name="googleClientSecret" type="password" placeholder={data.externalSignOn.googleClientSecretConfigured ? 'Configured' : ''} />
              <span class="help-text">Leave blank to keep the current saved secret.</span>
            </label>
          </div>
        {:else}
          <div class="split">
            <label>
              Entra tenant
              <input name="entraTenant" value={data.externalSignOn.entraTenant} placeholder="common" />
              <span class="help-text">Use <code>common</code> for broad Microsoft sign-in, or your tenant ID for one organization.</span>
            </label>
            <label>
              Application ID
              <input name="entraClientId" value={data.externalSignOn.entraClientId} />
              <span class="help-text">Application client ID from Microsoft Entra app registration.</span>
            </label>
          </div>
          <label>
            Entra client secret
            <input name="entraClientSecret" type="password" placeholder={data.externalSignOn.entraClientSecretConfigured ? 'Configured' : ''} />
            <span class="help-text">Leave blank to keep the current saved secret.</span>
          </label>
        {/if}

        <label>
          Current local admin password
          <input name="currentPassword" type="password" autocomplete="current-password" />
          <span class="help-text">Required before saving provider settings or connecting external sign-on.</span>
        </label>

        <div class="button-row">
          <button class="secondary" type="submit">Save provider settings</button>
          <button type="submit" formaction="?/connectExternalSignOn">Connect external sign-on</button>
        </div>
      </form>

      {#if data.externalSignOn.enabled}
        <form method="POST" action="?/removeExternalSignOn" class="panel-form" use:enhance>
          <div>
            <p class="eyebrow">Linked account</p>
            <h3>Remove external sign-on</h3>
            <p class="help-text">Removing the link stops external account login. Provider client settings are kept so you can reconnect later.</p>
          </div>
          <label>
            Current local admin password
            <input name="currentPassword" type="password" autocomplete="current-password" />
            <span class="help-text">Required before removing the linked account.</span>
          </label>
          <button class="danger" type="submit">Remove external sign-on</button>
        </form>
      {/if}
    </details>
    {/if}

    {#if sectionMatches('Test SMTP', ['send test email smtp accepted provider'])}
    <details class="settings-section settings-panel">
      <summary>Test SMTP</summary>
      <form method="POST" action="?/testSmtp" class="panel-form" use:enhance>
        <label>
          Send test to
          <input name="testEmail" type="email" value={data.settings.smtpFrom} required />
          <span class="help-text">Sends a small test message and reports whether the SMTP server accepted it.</span>
        </label>
        <button type="submit">Send test email</button>
      </form>
    </details>
    {/if}
  </div>
</section>

<style>
  .settings-page {
    display: grid;
    gap: 18px;
  }

  .settings-intro {
    max-width: 780px;
  }

  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 390px), 1fr));
    gap: 14px;
    align-items: start;
  }

  .settings-search {
    display: grid;
    gap: 8px;
    margin-top: 16px;
    max-width: 520px;
  }

  .settings-section {
    padding: 0;
    overflow: hidden;
  }

  .settings-section > summary {
    cursor: pointer;
    font-weight: 800;
    list-style-position: inside;
    padding: 18px 18px 16px;
  }

  .settings-section > summary:hover {
    background: rgba(37, 99, 235, 0.06);
  }

  .settings-section > .panel-form {
    border: 0;
    box-shadow: none;
    padding-top: 0;
  }

  .settings-panel.wide {
    grid-column: 1 / -1;
  }

  .panel-title-row {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 12px;
  }

  @media (max-width: 720px) {
    .split {
      grid-template-columns: 1fr;
    }
  }
</style>
