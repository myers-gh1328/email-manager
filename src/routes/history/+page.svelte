<script lang="ts">
  import { formatDateTime, messageStatusLabel, replySummary } from '$lib/shared/format';

  let { data } = $props();

  let historySearch = $derived(data.communicationPage.search ?? '');
  let historyReplyStatus = $derived(data.communicationPage.replyStatus ?? '');
  let historyStatus = $derived(data.communicationPage.status ?? '');
  let historyType = $derived(data.communicationPage.type ?? '');
  let currentHistoryPage = $derived(Math.floor(data.communicationPage.offset / data.communicationPage.limit) + 1);
  let totalHistoryPages = $derived(Math.max(Math.ceil(data.communicationPage.total / data.communicationPage.limit), 1));
  const typeFilters = [
    { value: '', label: 'All email types' },
    { value: 'direct', label: 'Direct' },
    { value: 'scheduled', label: 'Scheduled' }
  ];
  const statusFilters = [
    { value: '', label: 'All send statuses' },
    { value: 'sent', label: 'Sent' },
    { value: 'failed', label: 'Failed' }
  ];
  const replyFilters = [
    { value: '', label: 'All reply statuses' },
    { value: 'needs_reply', label: 'Needs reply' }
  ];
  let historyReturnTo = $derived(historyPageHref(currentHistoryPage));
  let newEmailHref = $derived(composeNewEmailHref());
  let historyClearHref = $derived(data.returnTo ? `/history?returnTo=${encodeURIComponent(data.returnTo)}` : '/history');

  function historyPageHref(page: number) {
    const params = new URLSearchParams();
    if (data.returnTo) params.set('returnTo', data.returnTo);
    if (data.communicationPage.search) params.set('search', data.communicationPage.search);
    if (data.selectedContactId) params.set('contactId', data.selectedContactId);
    if (data.selectedSourceId) params.set('sourceId', data.selectedSourceId);
    if (data.selectedReplyStatus) params.set('replyStatus', data.selectedReplyStatus);
    if (data.selectedStatus) params.set('status', data.selectedStatus);
    if (data.selectedType) params.set('type', data.selectedType);
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return query ? `/history?${query}` : '/history';
  }

  function replyFilterHref(replyStatus: string) {
    const params = new URLSearchParams();
    if (data.returnTo) params.set('returnTo', data.returnTo);
    if (data.communicationPage.search) params.set('search', data.communicationPage.search);
    if (data.selectedContactId) params.set('contactId', data.selectedContactId);
    if (data.selectedSourceId) params.set('sourceId', data.selectedSourceId);
    if (data.selectedStatus) params.set('status', data.selectedStatus);
    if (data.selectedType) params.set('type', data.selectedType);
    if (replyStatus) params.set('replyStatus', replyStatus);
    const query = params.toString();
    return query ? `/history?${query}` : '/history';
  }

  function statusFilterHref(status: string) {
    const params = new URLSearchParams();
    if (data.returnTo) params.set('returnTo', data.returnTo);
    if (data.communicationPage.search) params.set('search', data.communicationPage.search);
    if (data.selectedContactId) params.set('contactId', data.selectedContactId);
    if (data.selectedSourceId) params.set('sourceId', data.selectedSourceId);
    if (data.selectedReplyStatus) params.set('replyStatus', data.selectedReplyStatus);
    if (data.selectedType) params.set('type', data.selectedType);
    if (status) params.set('status', status);
    const query = params.toString();
    return query ? `/history?${query}` : '/history';
  }

  function typeFilterHref(type: string) {
    const params = new URLSearchParams();
    if (data.returnTo) params.set('returnTo', data.returnTo);
    if (data.communicationPage.search) params.set('search', data.communicationPage.search);
    if (data.selectedContactId) params.set('contactId', data.selectedContactId);
    if (data.selectedSourceId) params.set('sourceId', data.selectedSourceId);
    if (data.selectedReplyStatus) params.set('replyStatus', data.selectedReplyStatus);
    if (data.selectedStatus) params.set('status', data.selectedStatus);
    if (type) params.set('type', type);
    const query = params.toString();
    return query ? `/history?${query}` : '/history';
  }

  function composeNewEmailHref() {
    const params = new URLSearchParams();
    params.set('returnTo', historyReturnTo);
    return `/new-email?${params.toString()}`;
  }

</script>

<svelte:head>
  <title>History · Training Communications Studio</title>
</svelte:head>

<section class="band">
  <div class="section-heading compact">
    <div>
      <p class="eyebrow">History</p>
      <h2>Email history</h2>
    </div>
    <a class="button-link" href={newEmailHref}>New Email</a>
  </div>

  <section class="panel-form spaced">
    <div class="section-heading compact">
      <div>
        <h3>Search history</h3>
        <p class="help-text">Search sent, failed, and replied-to emails.</p>
      </div>
    </div>
    <form class="inline-filters" method="GET" action="/history">
      {#if data.returnTo}<input type="hidden" name="returnTo" value={data.returnTo} />{/if}
      {#if data.selectedContactId}<input type="hidden" name="contactId" value={data.selectedContactId} />{/if}
      {#if data.selectedSourceId}<input type="hidden" name="sourceId" value={data.selectedSourceId} />{/if}
      {#if data.selectedReplyStatus}<input type="hidden" name="replyStatus" value={data.selectedReplyStatus} />{/if}
      {#if data.selectedStatus}<input type="hidden" name="status" value={data.selectedStatus} />{/if}
      {#if data.selectedType}<input type="hidden" name="type" value={data.selectedType} />{/if}
      <label>
        <span class="sr-only">Search history</span>
        <input name="search" value={historySearch} placeholder="Search by name, email, or subject" />
      </label>
      <button class="secondary" type="submit">Search</button>
    </form>
    <div class="filter-groups">
      <div class="filter-group">
        <span class="filter-label">Type</span>
        <div class="segmented-control" aria-label="Filter email type">
          {#each typeFilters as filter}
            <a class:active={historyType === filter.value} href={typeFilterHref(filter.value)}>{filter.label}</a>
          {/each}
        </div>
      </div>
      <div class="filter-group">
        <span class="filter-label">Send status</span>
        <div class="segmented-control" aria-label="Filter email delivery status">
          {#each statusFilters as filter}
            <a class:active={historyStatus === filter.value} href={statusFilterHref(filter.value)}>{filter.label}</a>
          {/each}
        </div>
      </div>
      <div class="filter-group">
        <span class="filter-label">Replies</span>
        <div class="segmented-control" aria-label="Filter email history">
          {#each replyFilters as filter}
            <a class:active={historyReplyStatus === filter.value} href={replyFilterHref(filter.value)}>{filter.label}</a>
          {/each}
        </div>
      </div>
    </div>
    {#if data.selectedContactId || data.selectedSourceId || data.selectedReplyStatus || data.selectedStatus || data.selectedType}
      <div class="active-filters" aria-label="Active filters">
        <strong>Active filters</strong>
        {#if data.selectedContactId}<span class="pill">This contact</span>{/if}
        {#if data.selectedSourceId}<span class="pill">This scheduled email</span>{/if}
        {#if data.selectedReplyStatus}<span class="pill">Needs a reply</span>{/if}
        {#if data.selectedStatus}<span class="pill">{data.selectedStatus === 'failed' ? 'Failed emails' : 'Sent emails'}</span>{/if}
        {#if data.selectedType}<span class="pill">{data.selectedType === 'scheduled' ? 'Scheduled emails' : 'Direct emails'}</span>{/if}
        <a class="button-link" href={historyClearHref}>Clear filters</a>
      </div>
    {/if}
    <p class="help-text">
      Showing {data.communications.length} of {data.communicationPage.total} emails.
    </p>
    <div class="list">
      {#each data.communications as communication}
        <article class="row-card tall">
          <div>
            <a href={`/history/${communication.id}?returnTo=${encodeURIComponent(historyReturnTo)}`}><strong>{communication.subject}</strong></a>
            <p>
              {communication.contactName} · {communication.effectiveRecipient || communication.contactEmail}
              · {formatDateTime(communication.sentAt || communication.createdAt)}
            </p>
            <p>
              {communication.source === 'campaign' ? 'Scheduled email' : 'Direct email'}
              {#if communication.testMode} · Test mode{/if}
              {#if communication.originalRecipient && communication.effectiveRecipient && communication.originalRecipient !== communication.effectiveRecipient}
                · Intended for {communication.originalRecipient}
              {/if}
            </p>
            {#if communication.errorMessage}<p class="error">Error: {communication.errorMessage}</p>{/if}
          </div>
          <dl class="history-facts">
            <div>
              <dt>Send status</dt>
              <dd><span class:good={communication.status === 'accepted' || communication.status === 'sent'} class="pill">{messageStatusLabel(communication.status)}</span></dd>
            </div>
            <div>
              <dt>Replies</dt>
              <dd>
                <span class:good={communication.replyCount && !communication.unhandledReplyCount} class:warn={communication.unhandledReplyCount} class="pill">
                  {replySummary({ replyCount: communication.replyCount, unhandledReplyCount: communication.unhandledReplyCount })}
                </span>
              </dd>
            </div>
          </dl>
        </article>
      {:else}
        <p class="empty">No email history recorded yet.</p>
      {/each}
    </div>
    {#if totalHistoryPages > 1}
      <nav class="pagination" aria-label="History pages">
        <a class="button-link" aria-disabled={currentHistoryPage === 1} href={historyPageHref(Math.max(currentHistoryPage - 1, 1))}>Previous</a>
        <span>Page {currentHistoryPage} of {totalHistoryPages}</span>
        <a
          class="button-link"
          aria-disabled={currentHistoryPage >= totalHistoryPages}
          href={historyPageHref(Math.min(currentHistoryPage + 1, totalHistoryPages))}
        >
          Next
        </a>
      </nav>
    {/if}
  </section>
</section>

<style>
  .history-facts {
    align-items: flex-end;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
  }

  .history-facts div {
    display: grid;
    gap: 4px;
    justify-items: end;
  }

  .history-facts dt {
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .inline-filters,
  .active-filters,
  .pagination {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0;
  }

  .filter-groups {
    display: grid;
    gap: 8px;
    margin: 12px 0;
  }

  .filter-group {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .filter-label {
    color: var(--muted);
    font-size: 0.82rem;
    font-weight: 700;
    min-width: 64px;
    text-transform: uppercase;
  }

  @media (max-width: 720px) {
    .history-facts {
      align-items: stretch;
    }

    .history-facts div {
      justify-items: start;
    }
  }
</style>
