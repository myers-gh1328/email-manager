<script lang="ts">
  import { enhance } from '$app/forms';
  import { deliveryStatusLabel } from '$lib/shared/format';

  let { data, form } = $props();
  const retryableStatuses = ['failed', 'retry_scheduled', 'needs_attention'];
  let retryableRecipientCount = $derived(data.recipients.filter((recipient) => retryableStatuses.includes(recipient.status)).length);

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
    <dl class="detail-facts">
      <div>
        <dt>Status</dt>
        <dd><span class:good={data.campaign.approved} class="pill">{data.campaign.approved ? 'Ready to send' : 'Draft'}</span></dd>
      </div>
      <div>
        <dt>Class</dt>
        <dd>{data.campaign.courseName} · {formatClassSchedule(data.campaign)}</dd>
      </div>
      <div>
        <dt>Template</dt>
        <dd>{data.campaign.templateName}</dd>
      </div>
      <div>
        <dt>Send time</dt>
        <dd>{formatDateTime(data.campaign.scheduledFor)}</dd>
      </div>
    </dl>
    {#if form?.message}<p class={form.error || form.message.includes('cannot') ? 'error spaced' : 'success spaced'}>{form.message}</p>{/if}

    <div class="preview-list">
      <h3>Recipients</h3>
      <form method="POST" action="?/retrySelected" use:enhance>
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
    </div>
  </div>

  <div class="form-stack">
    <form method="POST" action="?/updateCampaign" class="panel-form" use:enhance>
      <h3>Edit schedule</h3>
      <label>Name<input name="name" value={data.campaign.name} required /></label>
      <label>Send at<input name="scheduledFor" type="datetime-local" value={data.scheduledForInput} required /></label>
      {#if data.campaign.approved}
        <label class="check"><input name="scheduleMode" type="checkbox" value="ready" checked /> Ready to send</label>
      {:else}
        <input name="scheduleMode" type="hidden" value="draft" />
        <p class="body-copy">Draft emails need a student preview before they can be marked ready.</p>
      {/if}
      <div class="button-row">
        <button type="submit">Update scheduled email</button>
        <button class="danger" type="submit" formaction="?/deleteCampaign" onclick={confirmDelete}>Delete scheduled email</button>
      </div>
    </form>
    <section class="panel-form">
      <h3>Template snapshot</h3>
      <p><strong>{data.template.subject}</strong></p>
      <pre>{data.template.body}</pre>
    </section>
  </div>
</section>
