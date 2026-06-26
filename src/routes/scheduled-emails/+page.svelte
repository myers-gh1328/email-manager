<script lang="ts">
  import { enhance } from '$app/forms';
  import SearchSelect from '$lib/SearchSelect.svelte';
  import { scheduledEmailDeliverySummary, scheduledEmailStatusLabel } from '$lib/shared/format';

  let { data, form } = $props();
  let classOptions = $derived(data.classSessionOptions);
  let templateOptions = $derived(data.templateOptions);
  let campaignsSearch = $derived(data.campaignsPage.search ?? '');
  let campaignsStatus = $derived(data.campaignsPage.status ?? '');
  let currentCampaignsPage = $derived(Math.floor(data.campaignsPage.offset / data.campaignsPage.limit) + 1);
  let totalCampaignsPages = $derived(Math.max(Math.ceil(data.campaignsPage.total / data.campaignsPage.limit), 1));
  let scheduledEmailReturnTo = $derived(campaignsPageHref(currentCampaignsPage));
  let campaignWorkflowReturnTo = $derived(
    `/scheduled-emails${data.action ? `?action=${encodeURIComponent(data.action)}&returnTo=${encodeURIComponent(data.returnTo || scheduledEmailReturnTo)}` : ''}`
  );
  let addClassHref = $derived(`/classes?action=session&returnTo=${encodeURIComponent(campaignWorkflowReturnTo)}`);
  let addTemplateHref = $derived(`/templates?action=create&returnTo=${encodeURIComponent(campaignWorkflowReturnTo)}`);
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

  function campaignsPageHref(page: number) {
    const params = new URLSearchParams();
    if (data.returnTo) params.set('returnTo', data.returnTo);
    if (data.campaignsPage.search) params.set('search', data.campaignsPage.search);
    if (data.campaignsPage.status) params.set('status', data.campaignsPage.status);
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return query ? `/scheduled-emails?${query}` : '/scheduled-emails';
  }

  function statusFilterHref(status: string) {
    const params = new URLSearchParams();
    if (data.returnTo) params.set('returnTo', data.returnTo);
    if (data.campaignsPage.search) params.set('search', data.campaignsPage.search);
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
        <h2>Manage scheduled emails</h2>
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
        <input name="search" value={campaignsSearch} placeholder="Name, class, or template" />
      </label>
      <button type="submit">Search</button>
      {#if data.campaignsPage.search || data.campaignsPage.status}<a class="button-link" href={data.returnTo ? `/scheduled-emails?returnTo=${encodeURIComponent(data.returnTo)}` : '/scheduled-emails'}>Clear</a>{/if}
    </form>
    <div class="segmented-control" aria-label="Filter scheduled emails">
      {#each statusFilters as filter}
        <a class:active={campaignsStatus === filter.value} href={statusFilterHref(filter.value)}>{filter.label}</a>
      {/each}
    </div>
    <p class="help-text">Showing {data.campaigns.length} of {data.campaignsPage.total} scheduled emails.</p>
    <div class="list">
      {#each data.campaigns as campaign}
        <article class="row-card">
          <div>
            <a href={`/scheduled-emails/${campaign.id}?returnTo=${encodeURIComponent(scheduledEmailReturnTo)}`}><strong>{campaign.name}</strong></a>
            <p>{campaign.courseName} · {campaign.templateName} · {formatDateTime(campaign.scheduledFor)}</p>
            <p>{scheduledEmailDeliverySummary(campaign)}</p>
          </div>
          <span class:good={campaign.readyToSend} class="pill">{scheduledEmailStatusLabel(campaign.readyToSend)}</span>
        </article>
      {:else}
        <p class="empty">No scheduled emails yet.</p>
      {/each}
    </div>
    {#if totalCampaignsPages > 1}
      <nav class="pagination" aria-label="Scheduled email pages">
        <a class="button-link" aria-disabled={currentCampaignsPage === 1} href={campaignsPageHref(Math.max(currentCampaignsPage - 1, 1))}>Previous</a>
        <span>Page {currentCampaignsPage} of {totalCampaignsPages}</span>
        <a
          class="button-link"
          aria-disabled={currentCampaignsPage >= totalCampaignsPages}
          href={campaignsPageHref(Math.min(currentCampaignsPage + 1, totalCampaignsPages))}
        >
          Next
        </a>
      </nav>
    {/if}
    {#if form?.previews}
      <div class="preview-list">
        <h3>Scheduled email preview</h3>
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
        <h3>Choose send time</h3>
        <input name="classSessionId" type="hidden" value={form.classSessionId} />
        <input name="templateId" type="hidden" value={form.templateId} />
        <input name="previewToken" type="hidden" value={form.previewToken} />
        <input name="scheduleMode" type="hidden" value="ready" />
        {#if data.returnTo}<input name="returnTo" type="hidden" value={data.returnTo} />{/if}
        {#if campaignsSearch}<input name="search" type="hidden" value={campaignsSearch} />{/if}
        {#if campaignsStatus}<input name="status" type="hidden" value={campaignsStatus} />{/if}
        {#if currentCampaignsPage > 1}<input name="page" type="hidden" value={currentCampaignsPage} />{/if}
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
          <button type="submit">Preview personalization</button>
          <a class="button-link" href={data.returnTo || '/scheduled-emails'}>Cancel</a>
        </div>
      </form>
    {/if}
  </div>
</section>
