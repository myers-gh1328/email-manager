<script lang="ts">
  import { enhance } from '$app/forms';
  import { deliveryStatusLabel } from '$lib/shared/format';

  let { data, form } = $props();

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function formatClassSchedule(session: { startsOn: string; endsOn?: string; startTime?: string }) {
    const endsOn = session.endsOn || session.startsOn;
    const dateRange = endsOn !== session.startsOn ? `${session.startsOn} - ${endsOn}` : session.startsOn;
    return session.startTime ? `${dateRange} · ${session.startTime}` : dateRange;
  }

  function confirmDelete() {
    return confirm('Delete this scheduled email? Draft and unsent delivery rows will be removed.');
  }
</script>

<svelte:head>
  <title>{data.campaign.name} · Scheduled Email</title>
</svelte:head>

<section class="band two-column">
  <div>
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">Scheduled email detail</p>
        <h2>{data.campaign.name}</h2>
      </div>
      <a class="button-link" href="/campaigns">Back</a>
    </div>
    <div class="status-row">
      <span class:good={data.campaign.approved}>{data.campaign.approved ? 'Ready to send' : 'Draft'}</span>
      <span>{data.campaign.courseName}</span>
      <span>{formatClassSchedule(data.campaign)}</span>
      <span>{data.campaign.templateName}</span>
      <span>{formatDateTime(data.campaign.scheduledFor)}</span>
    </div>
    {#if form?.message}<p class={form.error || form.message.includes('cannot') ? 'error spaced' : 'success spaced'}>{form.message}</p>{/if}

    <div class="preview-list">
      <h3>Recipients</h3>
      <form method="POST" action="?/retrySelected" use:enhance>
        {#each data.recipients as recipient}
          <article>
            <div class="row-card tall no-shadow">
              <div>
                {#if ['failed', 'retry_scheduled', 'needs_attention'].includes(recipient.status)}
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
        <button class="secondary" type="submit">Retry selected</button>
      </form>
    </div>
  </div>

  <div class="form-stack">
    <form method="POST" action="?/updateCampaign" class="panel-form" use:enhance>
      <h3>Lifecycle</h3>
      <label>Name<input name="name" value={data.campaign.name} required /></label>
      <label>Send at<input name="scheduledFor" type="datetime-local" value={data.scheduledForInput} required /></label>
      {#if data.campaign.approved}
        <label class="check"><input name="approved" type="checkbox" checked /> Ready to send</label>
      {:else}
        <p class="body-copy">Draft scheduled emails must be created from a preview-backed scheduling flow before they can send.</p>
      {/if}
      <div class="button-row">
        <button type="submit">Update scheduled email</button>
        <button class="danger" type="submit" formaction="?/deleteCampaign" onclick={confirmDelete}>Delete draft</button>
      </div>
    </form>
    <details class="action-panel">
      <summary>Template snapshot</summary>
      <section class="panel-form">
        <p><strong>{data.template.subject}</strong></p>
        <pre>{data.template.body}</pre>
      </section>
    </details>
  </div>
</section>
