<script lang="ts">
  import { enhance } from '$app/forms';
  import { formatDateTime } from '$lib/shared/format';

  let { data } = $props();

  let historySearch = $derived(data.communicationPage.search ?? '');
  let currentHistoryPage = $derived(Math.floor(data.communicationPage.offset / data.communicationPage.limit) + 1);
  let totalHistoryPages = $derived(Math.max(Math.ceil(data.communicationPage.total / data.communicationPage.limit), 1));

  function historyPageHref(page: number) {
    const params = new URLSearchParams();
    if (data.communicationPage.search) params.set('search', data.communicationPage.search);
    if (data.selectedContactId) params.set('contactId', data.selectedContactId);
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
        <h3>Every recorded email</h3>
        <p class="help-text">Search sent, failed, and replied-to emails without loading the compose workflow.</p>
      </div>
    </div>
    <form class="inline-filters" method="GET" action="/communications">
      {#if data.selectedContactId}<input type="hidden" name="contactId" value={data.selectedContactId} />{/if}
      <label>
        <span class="sr-only">Search history</span>
        <input name="search" value={historySearch} placeholder="Search by name, email, or subject" />
      </label>
      <button class="secondary" type="submit">Search</button>
    </form>
    <p class="help-text">
      Showing {data.communications.length} of {data.communicationPage.total} emails.
    </p>
    <div class="list">
      {#each data.communications as communication}
        <article class="row-card tall">
          <div>
            <strong>{communication.subject}</strong>
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
            {#if communication.replies.length}
              <div class="reply-list">
                {#each communication.replies as reply}
                  <article class="reply-card">
                    <div>
                      <strong>{reply.fromName || reply.fromEmail || 'Reply'}</strong>
                      <p>{formatDateTime(reply.receivedAt)}{#if reply.subject} · {reply.subject}{/if}</p>
                      <p>{reply.snippet || reply.textBody}</p>
                    </div>
                    {#if reply.reviewedAt}
                      <span class="pill good">Reviewed</span>
                    {:else}
                      <form method="POST" action="?/markReplyReviewed" use:enhance>
                        <input name="replyId" type="hidden" value={reply.id} />
                        <button class="secondary" type="submit">Mark reviewed</button>
                      </form>
                    {/if}
                  </article>
                {/each}
              </div>
            {/if}
          </div>
          <div class="status-stack">
            <span class:good={communication.status === 'accepted' || communication.status === 'sent'} class="pill">{communication.status}</span>
            {#if communication.replyCount}
              <span class="pill good">Acknowledged</span>
              {#if communication.unreviewedReplyCount}<span class="pill warn">{communication.unreviewedReplyCount} new</span>{/if}
            {:else if communication.status === 'accepted' || communication.status === 'sent'}
              <span class="pill">No reply yet</span>
            {/if}
          </div>
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
  .reply-list {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }

  .reply-card {
    align-items: start;
    background: rgba(37, 99, 235, 0.05);
    border: 1px solid rgba(37, 99, 235, 0.16);
    border-radius: 8px;
    display: flex;
    gap: 10px;
    justify-content: space-between;
    padding: 10px;
  }

  .status-stack {
    align-items: flex-end;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .inline-filters,
  .pagination {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0;
  }

  @media (max-width: 720px) {
    .reply-card,
    .status-stack {
      align-items: stretch;
    }
  }
</style>
