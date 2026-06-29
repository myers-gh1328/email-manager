<script lang="ts">
  import { enhance } from '$app/forms';
  import SearchSelect from '$lib/SearchSelect.svelte';
  import { scheduledEmailSendSummary, scheduledEmailStatusLabel } from '$lib/shared/format';

  let { data, form } = $props();
  let classOptions = $derived(data.classSessionOptions);
  let templateOptions = $derived(data.templateOptions);
  let scheduledEmails = $derived(data.campaigns);
  let scheduledEmailsPage = $derived(data.campaignsPage);
  let scheduledEmailsSearch = $derived(scheduledEmailsPage.search ?? '');
  let scheduledEmailsStatus = $derived(scheduledEmailsPage.status ?? '');
  let currentScheduledEmailsPage = $derived(Math.floor(scheduledEmailsPage.offset / scheduledEmailsPage.limit) + 1);
  let totalScheduledEmailsPages = $derived(Math.max(Math.ceil(scheduledEmailsPage.total / scheduledEmailsPage.limit), 1));
  let scheduledEmailReturnTo = $derived(scheduledEmailsPageHref(currentScheduledEmailsPage));
  let scheduledEmailWorkflowReturnTo = $derived(
    `/scheduled-emails${data.action ? `?action=${encodeURIComponent(data.action)}&returnTo=${encodeURIComponent(data.returnTo || scheduledEmailReturnTo)}` : ''}`
  );
  let addClassHref = $derived(`/classes?action=session&returnTo=${encodeURIComponent(scheduledEmailWorkflowReturnTo)}`);
  let addTemplateHref = $derived(`/templates?action=create&returnTo=${encodeURIComponent(scheduledEmailWorkflowReturnTo)}`);
  const statusFilters = [
    { value: '', label: 'All' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'ready', label: 'Ready to send' },
    { value: 'needs_attention', label: 'Needs attention' },
    { value: 'sent', label: 'Sent' },
    { value: 'needs_preview', label: 'Needs preview' }
  ];

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function scheduledEmailsPageHref(page: number) {
    const params = new URLSearchParams();
    if (data.returnTo) params.set('returnTo', data.returnTo);
    if (scheduledEmailsPage.search) params.set('search', scheduledEmailsPage.search);
    if (scheduledEmailsPage.status) params.set('status', scheduledEmailsPage.status);
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return query ? `/scheduled-emails?${query}` : '/scheduled-emails';
  }

  function statusFilterHref(status: string) {
    const params = new URLSearchParams();
    if (data.returnTo) params.set('returnTo', data.returnTo);
    if (scheduledEmailsPage.search) params.set('search', scheduledEmailsPage.search);
    if (status) params.set('status', status);
    const query = params.toString();
    return query ? `/scheduled-emails?${query}` : '/scheduled-emails';
  }
</script>

<svelte:head>
  <title>Scheduled Emails · Training Communications Studio</title>
</svelte:head>

<section class="band">
  <div>
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">Scheduled Emails</p>
        <h2>Scheduled emails</h2>
      </div>
    </div>
    {#if form?.message || data.actionMessage}<p class={form?.error ? 'error spaced' : 'success spaced'}>{form?.message || data.actionMessage}</p>{/if}
    <div class="action-row">
      <a class:active={data.action === 'preview'} class="button-link" href={`/scheduled-emails?action=preview&returnTo=${encodeURIComponent(scheduledEmailReturnTo)}`}>Create scheduled email</a>
    </div>
    <form class="inline-filters" method="GET" action="/scheduled-emails">
      {#if data.returnTo}<input name="returnTo" type="hidden" value={data.returnTo} />{/if}
      <label>
        Search scheduled emails
        <input name="search" value={scheduledEmailsSearch} placeholder="Name, class, or template" />
      </label>
      <button type="submit">Search</button>
      {#if scheduledEmailsPage.search || scheduledEmailsPage.status}<a class="button-link" href={data.returnTo ? `/scheduled-emails?returnTo=${encodeURIComponent(data.returnTo)}` : '/scheduled-emails'}>Clear</a>{/if}
    </form>
    <div class="segmented-control" aria-label="Filter scheduled emails">
      {#each statusFilters as filter}
        <a class:active={scheduledEmailsStatus === filter.value} href={statusFilterHref(filter.value)}>{filter.label}</a>
      {/each}
    </div>
    <p class="help-text">Showing {scheduledEmails.length} of {scheduledEmailsPage.total} scheduled emails.</p>
    <div class="list">
      {#each scheduledEmails as scheduledEmail}
        <article class="row-card">
          <div>
            <a href={`/scheduled-emails/${scheduledEmail.id}?returnTo=${encodeURIComponent(scheduledEmailReturnTo)}`}><strong>{scheduledEmail.name}</strong></a>
            <p>{scheduledEmail.courseName} · {scheduledEmail.templateName} · {formatDateTime(scheduledEmail.scheduledFor)}</p>
            <p>{scheduledEmailSendSummary(scheduledEmail)}</p>
          </div>
          <span class:good={scheduledEmail.readyToSend} class="pill">{scheduledEmailStatusLabel(scheduledEmail.readyToSend)}</span>
        </article>
      {:else}
        <p class="empty">No scheduled emails yet.</p>
      {/each}
    </div>
    {#if totalScheduledEmailsPages > 1}
      <nav class="pagination" aria-label="Scheduled email pages">
        <a class="button-link" aria-disabled={currentScheduledEmailsPage === 1} href={scheduledEmailsPageHref(Math.max(currentScheduledEmailsPage - 1, 1))}>Previous</a>
        <span>Page {currentScheduledEmailsPage} of {totalScheduledEmailsPages}</span>
        <a
          class="button-link"
          aria-disabled={currentScheduledEmailsPage >= totalScheduledEmailsPages}
          href={scheduledEmailsPageHref(Math.min(currentScheduledEmailsPage + 1, totalScheduledEmailsPages))}
        >
          Next
        </a>
      </nav>
    {/if}
    {#if form?.previews}
      <div class="preview-list">
        <h3>Scheduled email preview</h3>
        <p class="body-copy">Will create one scheduled email for the selected class. Each student gets their own message.</p>
        {#each form.previews as preview}
          <article>
            <strong>{preview.contact.firstName} {preview.contact.lastName}</strong>
            <p>{preview.subject}</p>
            <pre>{preview.body}</pre>
            {#if preview.missing.length}<p class="error">Missing template fields: {preview.missing.join(', ')}</p>{/if}
            {#if preview.skipped}<p class="error">Skipped because: {preview.reason}</p>{/if}
          </article>
        {/each}
      </div>
      <form method="POST" action="?/createCampaign" class="panel-form spaced" use:enhance>
        <h3>Create scheduled email</h3>
        <input name="classSessionId" type="hidden" value={form.classSessionId} />
        <input name="templateId" type="hidden" value={form.templateId} />
        <input name="previewToken" type="hidden" value={form.previewToken} />
        <input name="scheduleMode" type="hidden" value="ready" />
        {#if data.returnTo}<input name="returnTo" type="hidden" value={data.returnTo} />{/if}
        {#if scheduledEmailsSearch}<input name="search" type="hidden" value={scheduledEmailsSearch} />{/if}
        {#if scheduledEmailsStatus}<input name="status" type="hidden" value={scheduledEmailsStatus} />{/if}
        {#if currentScheduledEmailsPage > 1}<input name="page" type="hidden" value={currentScheduledEmailsPage} />{/if}
        <label>Name<input name="name" placeholder="Welcome email" required /></label>
        <label>Send at<input name="scheduledFor" type="datetime-local" required /></label>
        <button type="submit">Create scheduled email</button>
      </form>
    {/if}
  </div>
  <div class="form-stack">
    {#if data.action === 'preview'}
      <form method="POST" action="?/previewCampaign" class="panel-form" use:enhance>
        <h3>Preview scheduled email</h3>
        <SearchSelect
          name="classSessionId"
          label="Class"
          options={classOptions}
          placeholder="Search classes"
          addHref={addClassHref}
          addLabel="Add class"
          searchHref="/classes/search"
          required
        />
        <SearchSelect
          name="templateId"
          label="Template"
          options={templateOptions}
          placeholder="Search templates"
          addHref={addTemplateHref}
          addLabel="Add template"
          searchHref="/templates/search"
          required
        />
        <div class="button-row">
          <button type="submit">Preview scheduled email</button>
          <a class="button-link" href={data.returnTo || '/scheduled-emails'}>Cancel</a>
        </div>
      </form>
    {/if}
  </div>
</section>
