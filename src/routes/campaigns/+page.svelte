<script lang="ts">
  import { enhance } from '$app/forms';
  import SearchSelect from '$lib/SearchSelect.svelte';

  let { data, form } = $props();
  let classOptions = $derived(
    data.classSessions.map((session) => ({ value: session.id, label: `${session.courseName} · ${formatClassSchedule(session)}` }))
  );
  let templateOptions = $derived(data.templates.map((template) => ({ value: template.id, label: template.name })));

  function formatClassSchedule(session: { startsOn: string; endsOn?: string; startTime?: string }) {
    const endsOn = session.endsOn || session.startsOn;
    const dateRange = endsOn !== session.startsOn ? `${session.startsOn} - ${endsOn}` : session.startsOn;
    return session.startTime ? `${dateRange} · ${session.startTime}` : dateRange;
  }

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
</script>

<svelte:head>
  <title>Scheduled Emails · Training Communications Studio</title>
</svelte:head>

<section class="band two-column">
  <div>
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">Scheduled Emails</p>
        <h2>Schedule class emails</h2>
      </div>
    </div>
    {#if form?.message}<p class={form.error ? 'error spaced' : 'success spaced'}>{form.message}</p>{/if}
    <div class="action-row">
      <a class:active={data.action === 'preview'} class="button-link" href="/campaigns?action=preview">Preview class email</a>
      <a class:active={data.action === 'schedule'} class="button-link" href="/campaigns?action=schedule">Schedule class email</a>
    </div>
    <div class="list">
      {#each data.campaigns as campaign}
        <article class="row-card">
          <div>
            <a href={`/campaigns/${campaign.id}`}><strong>{campaign.name}</strong></a>
            <p>{campaign.courseName} · {campaign.templateName} · {formatDateTime(campaign.scheduledFor)}</p>
          </div>
          <span class:good={campaign.approved} class="pill">{campaign.approved ? 'Scheduled' : 'Draft'}</span>
        </article>
      {:else}
        <p class="empty">No class emails scheduled.</p>
      {/each}
    </div>
    {#if form?.previews}
      <div class="preview-list">
        <h3>Preview</h3>
        {#each form.previews as preview}
          <article>
            <strong>{preview.contact.firstName} {preview.contact.lastName}</strong>
            <p>{preview.subject}</p>
            <pre>{preview.body}</pre>
            {#if preview.missing.length}<p class="error">Missing: {preview.missing.join(', ')}</p>{/if}
            {#if preview.skipped}<p class="error">Skipped: {preview.reason}</p>{/if}
          </article>
        {/each}
      </div>
      <form method="POST" action="?/createCampaign" class="panel-form spaced" use:enhance>
        <h3>Schedule this preview</h3>
        <input name="classSessionId" type="hidden" value={form.classSessionId} />
        <input name="templateId" type="hidden" value={form.templateId} />
        <input name="previewToken" type="hidden" value={form.previewToken} />
        <input name="scheduleMode" type="hidden" value="ready" />
        <label>Name<input name="name" placeholder="Welcome email" required /></label>
        <label>Send at<input name="scheduledFor" type="datetime-local" required /></label>
        <button type="submit">Create schedule</button>
      </form>
    {/if}
  </div>
  <div class="form-stack">
    {#if data.action === 'preview'}
      <form method="POST" action="?/previewCampaign" class="panel-form" use:enhance>
        <h3>Preview class email</h3>
        <SearchSelect name="classSessionId" label="Class" options={classOptions} placeholder="Search classes" required />
        <SearchSelect name="templateId" label="Template" options={templateOptions} placeholder="Search templates" required />
        <div class="button-row">
          <button type="submit">Preview personalization</button>
          <a class="button-link" href="/campaigns">Cancel</a>
        </div>
      </form>
    {/if}
    {#if data.action === 'schedule'}
      <form method="POST" action="?/createCampaign" class="panel-form" use:enhance>
        <h3>Schedule class email</h3>
        <label>Name<input name="name" placeholder="Welcome email" required /></label>
        <SearchSelect name="classSessionId" label="Class" options={classOptions} placeholder="Search classes" required />
        <SearchSelect name="templateId" label="Template" options={templateOptions} placeholder="Search templates" required />
        <label>Send at<input name="scheduledFor" type="datetime-local" required /></label>
        <input name="scheduleMode" type="hidden" value="draft" />
        <span class="help-text">Draft schedules are not sent. Preview the class email first to create a scheduled send.</span>
        <div class="button-row">
          <button type="submit">Create draft schedule</button>
          <a class="button-link" href="/campaigns">Cancel</a>
        </div>
      </form>
    {/if}
  </div>
</section>
