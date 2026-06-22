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

  function noticeClass(message: string) {
    return message.includes('accepted') || message.includes('connected') || message.includes('saved') || message.includes('updated')
      ? 'success spaced'
      : 'error spaced';
  }

  function sectionMatches(title: string, terms: string[]) {
    const query = settingsSearch.trim().toLowerCase();
    if (!query) return true;
    return [title, ...terms].join(' ').toLowerCase().includes(query);
  }
</script>

<svelte:head>
  <title>Settings · Scuba Email Studio</title>
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
              <li>In Microsoft Entra admin center, create an app registration named <strong>Scuba Email Studio</strong>.</li>
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

    {#if sectionMatches('Security', ['change admin password app secret login credentials'])}
    <details class="settings-section settings-panel">
      <summary>Change admin password</summary>
      <form method="POST" action="?/changePassword" class="panel-form" use:enhance>
        <label>
          New password
          <input name="password" type="password" minlength="10" />
          <span class="help-text">Protects the app and student contact details. Use at least 10 characters.</span>
        </label>
        <button type="submit">Update password</button>
      </form>
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
