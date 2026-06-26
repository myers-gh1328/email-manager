<script lang="ts">
  import { enhance } from '$app/forms';
  import { formatDateTime, messageStatusLabel } from '$lib/shared/format';

  let { data } = $props();
  let communication = $derived(data.communication);
  let detailReturnTo = $derived(`/communications/${communication.id}${data.returnTo ? `?returnTo=${encodeURIComponent(data.returnTo)}` : ''}`);

  function replyHref(reply: { snippet: string; textBody: string }) {
    const params = new URLSearchParams();
    params.set('contactId', communication.contactId);
    params.set('subject', communication.subject.toLowerCase().startsWith('re:') ? communication.subject : `Re: ${communication.subject}`);
    const quoted = reply.snippet || reply.textBody;
    if (quoted) params.set('body', `\n\nOn their reply:\n${quoted}`);
    params.set('returnTo', detailReturnTo);
    return `/new-email?${params.toString()}`;
  }
</script>

<svelte:head>
  <title>{communication.subject} · History</title>
</svelte:head>

<section class="band">
  <div class="section-heading compact">
    <div>
      <p class="eyebrow">Email detail</p>
      <h2>{communication.subject}</h2>
    </div>
    <a class="button-link" href={data.returnTo || '/communications'}>Back to History</a>
  </div>

  {#if data.actionMessage}<p class="success spaced">{data.actionMessage}</p>{/if}

  <section class="panel-form spaced">
    <dl class="detail-facts">
      <div>
        <dt>Recipient</dt>
        <dd><a href={`/contacts?contactId=${communication.contactId}&returnTo=${encodeURIComponent(detailReturnTo)}`}>{communication.contactName}</a></dd>
      </div>
      <div>
        <dt>Delivery</dt>
        <dd><span class:good={communication.status === 'accepted' || communication.status === 'sent'} class="pill">{messageStatusLabel(communication.status)}</span></dd>
      </div>
      <div>
        <dt>Sent</dt>
        <dd>{formatDateTime(communication.sentAt || communication.createdAt)}</dd>
      </div>
      <div>
        <dt>Source</dt>
        <dd>
          {#if communication.source === 'campaign' && communication.sourceId}
            <a href={`/campaigns/${communication.sourceId}?returnTo=${encodeURIComponent(detailReturnTo)}`}>Scheduled email</a>
          {:else if communication.source === 'campaign'}
            Scheduled email
          {:else}
            Direct email
          {/if}
        </dd>
      </div>
      {#if communication.classSessionId}
        <div>
          <dt>Class</dt>
          <dd><a href={`/classes/${communication.classSessionId}?returnTo=${encodeURIComponent(detailReturnTo)}`}>{communication.className || 'Class detail'}</a></dd>
        </div>
      {/if}
    </dl>
    {#if communication.originalRecipient && communication.effectiveRecipient && communication.originalRecipient !== communication.effectiveRecipient}
      <p class="help-text">Intended for {communication.originalRecipient}; delivered to {communication.effectiveRecipient} because test mode changed the recipient.</p>
    {/if}
    {#if communication.providerMessage}<p class="help-text">{communication.providerMessage}</p>{/if}
    {#if communication.errorMessage}<p class="error">Error: {communication.errorMessage}</p>{/if}
  </section>

  <section class="panel-form spaced">
    <h3>Message</h3>
    <pre>{communication.body}</pre>
  </section>

  <section class="panel-form spaced">
    <div class="section-heading compact">
      <div>
        <h3>Replies</h3>
        <p class="help-text">Reply to the student or mark replies handled.</p>
      </div>
    </div>
    <div class="reply-list">
      {#each communication.replies as reply}
        <article class="reply-card">
          <div>
            <strong>{reply.fromName || reply.fromEmail || 'Reply'}</strong>
            <p>{formatDateTime(reply.receivedAt)}{#if reply.subject} · {reply.subject}{/if}</p>
            <p>{reply.snippet || reply.textBody}</p>
          </div>
          {#if reply.reviewedAt}
            <span class="pill good">Reply handled</span>
          {:else}
            <div class="button-row compact">
              <a class="button-link" href={replyHref(reply)}>Reply</a>
              <form method="POST" action="?/markReplyHandled" use:enhance>
                <input name="replyId" type="hidden" value={reply.id} />
                {#if data.returnTo}<input type="hidden" name="returnTo" value={data.returnTo} />{/if}
                <button class="secondary" type="submit">Mark handled</button>
              </form>
            </div>
          {/if}
        </article>
      {:else}
        <p class="empty">No replies recorded for this email.</p>
      {/each}
    </div>
  </section>
</section>

<style>
  .reply-list {
    display: grid;
    gap: 8px;
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

  @media (max-width: 720px) {
    .reply-card {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
