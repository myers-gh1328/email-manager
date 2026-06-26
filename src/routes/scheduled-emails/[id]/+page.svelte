<script lang="ts">
  import { enhance } from '$app/forms';
  import { deliveryStatusLabel, scheduledEmailStatusLabel } from '$lib/shared/format';

  let { data, form } = $props();
  const retryableStatuses = ['failed', 'retry_scheduled', 'needs_attention'];
  let retryableRecipientCount = $derived(data.recipients.filter((recipient) => retryableStatuses.includes(recipient.status)).length);
  let recipientSearch = $derived(data.recipientPage.search ?? '');
  let currentRecipientPage = $derived(Math.floor(data.recipientPage.offset / data.recipientPage.limit) + 1);
  let totalRecipientPages = $derived(Math.max(Math.ceil(data.recipientPage.total / data.recipientPage.limit), 1));
  let scheduledEmailDetailReturnTo = $derived(recipientPageHref(currentRecipientPage));

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function formatClassSchedule(session: { startsOn: string; endsOn?: string; startTime?: string }) {
    const endsOn = session.endsOn || session.startsOn;
    const dateRange = endsOn !== session.startsOn ? `${session.startsOn} - ${endsOn}` : session.startsOn;
    return session.startTime ? `${dateRange} · ${session.startTime}` : dateRange;
  }

  function confirmDelete() {
    return confirm('Delete this scheduled email? Unpreviewed and unsent delivery rows will be removed.');
  }

  function recipientPageHref(page: number) {
    const params = new URLSearchParams();
    if (data.recipientPage.search) params.set('search', data.recipientPage.search);
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return query ? `/scheduled-emails/${data.campaign.id}?${query}` : `/scheduled-emails/${data.campaign.id}`;
  }
</script>

<svelte:head>
  <title>{data.campaign.name} · Scheduled Email</title>
</svelte:head>

<section class="band">
  <div>
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">Scheduled email detail</p>
        <h2>{data.campaign.name}</h2>
      </div>
      <div class="button-row compact">
        <a class="button-link" href={`/history?sourceId=${data.campaign.id}&returnTo=${encodeURIComponent(scheduledEmailDetailReturnTo)}`}>View in History</a>
        <a class="button-link" href={data.returnTo || '/scheduled-emails'}>Back</a>
      </div>
    </div>
    <dl class="detail-facts">
      <div>
        <dt>Send readiness</dt>
        <dd><span class:good={data.campaign.readyToSend} class="pill">{scheduledEmailStatusLabel(data.campaign.readyToSend)}</span></dd>
      </div>
      <div>
        <dt>Class</dt>
        <dd><a href={`/classes/${data.campaign.classSessionId}?returnTo=${encodeURIComponent(scheduledEmailDetailReturnTo)}`}>{data.campaign.courseName}</a> · {formatClassSchedule(data.campaign)}</dd>
      </div>
      <div>
        <dt>Template</dt>
        <dd><a href={`/templates?templateId=${data.campaign.templateId}&returnTo=${encodeURIComponent(scheduledEmailDetailReturnTo)}`}>{data.campaign.templateName}</a></dd>
      </div>
      <div>
        <dt>Send time</dt>
        <dd>{formatDateTime(data.campaign.scheduledFor)}</dd>
      </div>
    </dl>
    {#if form?.message || data.actionMessage}
      <p class={form?.error || form?.message?.includes('cannot') ? 'error spaced' : 'success spaced'}>{form?.message || data.actionMessage}</p>
    {/if}

    <div class="preview-list">
      <h3>Recipients</h3>
      <form class="inline-filters" method="GET" action={`/scheduled-emails/${data.campaign.id}`}>
        <label>
          <span class="sr-only">Search recipients</span>
          <input name="search" value={recipientSearch} placeholder="Search recipients" />
        </label>
        <button class="secondary" type="submit">Search</button>
      </form>
      <p class="help-text">Showing {data.recipients.length} of {data.recipientPage.total} recipients.</p>
      <form method="POST" action="?/retrySelected" use:enhance>
        {#if data.returnTo}<input name="returnTo" value={data.returnTo} type="hidden" />{/if}
        {#if recipientSearch}<input name="search" type="hidden" value={recipientSearch} />{/if}
        {#if currentRecipientPage > 1}<input name="page" type="hidden" value={currentRecipientPage} />{/if}
        {#each data.recipients as recipient}
          <article>
            <div class="row-card tall no-shadow">
              <div>
                {#if retryableStatuses.includes(recipient.status)}
                  <label class="check"><input name="recipientIds" type="checkbox" value={recipient.contactId} /> <strong>{recipient.name}</strong></label>
                {:else}
                  <strong>{recipient.name}</strong>
                {/if}
                <p>{recipient.email}</p>
                {#if recipient.reason}<p class="error">{recipient.reason}</p>{/if}
                {#if recipient.delivery?.failureSummary}<p>{recipient.delivery.failureSummary}</p>{/if}
                {#if recipient.delivery?.attemptCount}<p>Attempts: {recipient.delivery.attemptCount}{recipient.delivery.nextAttemptAt ? ` · Next retry ${formatDateTime(recipient.delivery.nextAttemptAt)}` : ''}</p>{/if}
                {#if recipient.delivery?.providerMessage}<p>{recipient.delivery.providerMessage}</p>{/if}
              </div>
              <span class:good={recipient.status === 'sent'} class:warn={recipient.status === 'skipped' || recipient.status === 'needs_attention'} class="pill">{deliveryStatusLabel(recipient.status)}</span>
            </div>
          </article>
        {:else}
          <p class="empty">No recipients enrolled.</p>
        {/each}
        {#if retryableRecipientCount}
          <button class="secondary" type="submit">Retry selected</button>
        {:else if data.recipients.length}
          <p class="help-text">No failed recipients to retry.</p>
        {/if}
      </form>
      {#if totalRecipientPages > 1}
        <nav class="pagination" aria-label="Recipient pages">
          <a class="button-link" aria-disabled={currentRecipientPage === 1} href={recipientPageHref(Math.max(currentRecipientPage - 1, 1))}>Previous</a>
          <span>Page {currentRecipientPage} of {totalRecipientPages}</span>
          <a
            class="button-link"
            aria-disabled={currentRecipientPage >= totalRecipientPages}
            href={recipientPageHref(Math.min(currentRecipientPage + 1, totalRecipientPages))}
          >
            Next
          </a>
        </nav>
      {/if}
    </div>
  </div>

  <div class="form-stack">
    <form method="POST" action="?/updateCampaign" class="panel-form" use:enhance>
      <h3>Edit schedule</h3>
      {#if data.returnTo}<input name="returnTo" value={data.returnTo} type="hidden" />{/if}
      {#if recipientSearch}<input name="search" type="hidden" value={recipientSearch} />{/if}
      {#if currentRecipientPage > 1}<input name="page" type="hidden" value={currentRecipientPage} />{/if}
      <label>Name<input name="name" value={data.campaign.name} required /></label>
      <label>Send at<input name="scheduledFor" type="datetime-local" value={data.scheduledForInput} required /></label>
      {#if data.campaign.readyToSend}
        <label class="check"><input name="scheduleMode" type="checkbox" value="ready" checked /> Ready to send</label>
      {:else}
        <p class="body-copy">Emails needing preview must be previewed with the current roster before they can be marked ready.</p>
      {/if}
      <div class="button-row">
        <button type="submit">Update scheduled email</button>
        <button class="danger" type="submit" formaction="?/deleteCampaign" onclick={confirmDelete}>Delete scheduled email</button>
      </div>
    </form>
    <section class="panel-form">
      <h3>Email content</h3>
      <p><strong>{data.template.subject}</strong></p>
      <pre>{data.template.body}</pre>
    </section>
  </div>
</section>

<style>
  .inline-filters,
  .pagination {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0;
  }
</style>
