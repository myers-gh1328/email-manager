<script lang="ts">
  import { formatDateTime, messageStatusLabel } from '$lib/shared/format';

  let { data } = $props();

  let historySearch = $derived(data.communicationPage.search ?? '');
  let currentHistoryPage = $derived(Math.floor(data.communicationPage.offset / data.communicationPage.limit) + 1);
  let totalHistoryPages = $derived(Math.max(Math.ceil(data.communicationPage.total / data.communicationPage.limit), 1));

  function historyPageHref(page: number) {
    const params = new URLSearchParams();
    if (data.communicationPage.search) params.set('search', data.communicationPage.search);
    if (data.selectedContactId) params.set('contactId', data.selectedContactId);
    if (data.selectedSourceId) params.set('sourceId', data.selectedSourceId);
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return query ? `/communications?${query}` : '/communications';
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
    <a class="button-link" href="/new-email">New Email</a>
  </div>

  <section class="panel-form spaced">
    <div class="section-heading compact">
      <div>
        <h3>Email records</h3>
        <p class="help-text">Search sent, failed, and replied-to emails.</p>
      </div>
    </div>
    <form class="inline-filters" method="GET" action="/communications">
      {#if data.selectedContactId}<input type="hidden" name="contactId" value={data.selectedContactId} />{/if}
      {#if data.selectedSourceId}<input type="hidden" name="sourceId" value={data.selectedSourceId} />{/if}
      <label>
        <span class="sr-only">Search history</span>
        <input name="search" value={historySearch} placeholder="Search by name, email, or subject" />
      </label>
      <button class="secondary" type="submit">Search</button>
    </form>
    {#if data.selectedContactId || data.selectedSourceId}
      <div class="active-filters" aria-label="Active filters">
        <strong>Active filters</strong>
        {#if data.selectedContactId}<span class="pill">Filtered to selected contact</span>{/if}
        {#if data.selectedSourceId}<span class="pill">Filtered to selected scheduled email</span>{/if}
        <a class="button-link" href="/communications">Clear filters</a>
      </div>
    {/if}
    <p class="help-text">
      Showing {data.communications.length} of {data.communicationPage.total} emails.
    </p>
    <div class="list">
      {#each data.communications as communication}
        <article class="row-card tall">
          <div>
            <a href={`/communications/${communication.id}`}><strong>{communication.subject}</strong></a>
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
              <dt>Delivery</dt>
              <dd><span class:good={communication.status === 'accepted' || communication.status === 'sent'} class="pill">{messageStatusLabel(communication.status)}</span></dd>
            </div>
            <div>
              <dt>Replies</dt>
              <dd>
                {#if communication.replyCount}
                  <span class="pill good">Student replied</span>
                  {#if communication.unreviewedReplyCount}<span class="pill warn">{communication.unreviewedReplyCount} Needs reply</span>{/if}
                {:else}
                  <span class="muted">None</span>
                {/if}
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

  @media (max-width: 720px) {
    .history-facts {
      align-items: stretch;
    }

    .history-facts div {
      justify-items: start;
    }
  }
</style>
