	<script lang="ts">
	  import { enhance } from '$app/forms';
	  import { formatDateTime } from '$lib/shared/format';

	  let { data, form } = $props();
	</script>

<svelte:head>
  <title>Dashboard · Training Communications Studio</title>
</svelte:head>

<section class="band">
  <div class="section-heading">
    <div>
      <p class="eyebrow">Overview</p>
      <h2>Upcoming class email work</h2>
    </div>
    <form method="POST" action="?/sendDueCampaigns" use:enhance>
      <button type="submit" disabled={!data.settings.schedulerEnabled}>Send due now</button>
    </form>
  </div>

  <div class="metric-grid">
    <article><span>{data.stats.contacts}</span><p>Contacts</p></article>
    <article><span>{data.stats.classSessions}</span><p>Scheduled classes</p></article>
    <article><span>{data.stats.templates}</span><p>Templates</p></article>
    <article><span>{data.stats.pendingDeliveries}</span><p>Pending sends</p></article>
  </div>

  <div class="status-row">
    <span class:good={data.schedulerStatus.ready}>{data.schedulerStatus.ready ? 'Automatic sending ready' : 'Automatic sending blocked'}</span>
    <span class:good={data.settings.smtpHost && data.settings.smtpFrom}>{data.settings.smtpHost && data.settings.smtpFrom ? 'SMTP configured' : 'SMTP incomplete'}</span>
    <span class:good={!data.settings.emailTestModeEnabled}>{data.settings.emailTestModeEnabled ? 'Test mode on' : 'Live delivery mode'}</span>
    <span class:good={data.remoteStatus.ready}>{data.remoteStatus.enabled ? (data.remoteStatus.ready ? 'Remote access ready' : 'Remote access needs setup') : 'Local/private mode'}</span>
    <span class:good={data.settings.aiEnabled}>{data.settings.aiEnabled ? 'AI enabled' : 'AI disabled'}</span>
  </div>

  <section class="panel-form spaced">
    <h3>Scheduler status</h3>
    {#if data.schedulerStatus.ready}
      <p class="success">Automatic sending is enabled and not blocked by test mode or SMTP setup.</p>
    {:else}
      <div class="list">
        {#each data.schedulerStatus.blockedReasons as reason}
          <p class="error">{reason}</p>
        {/each}
      </div>
    {/if}
    <div class="status-row">
      <span>{data.schedulerStatus.dueApprovedCount} approved due now</span>
      {#if data.schedulerStatus.nextApproved}
        <span>Next sends {formatDateTime(data.schedulerStatus.nextApproved.scheduledFor)}</span>
      {:else}
        <span>No upcoming approved sends</span>
      {/if}
    </div>
  </section>

  {#if data.remoteStatus.enabled && !data.remoteStatus.ready}
    <section class="panel-form spaced">
      <h3>Remote access setup</h3>
      <div class="list">
        {#each data.remoteStatus.blockedReasons as reason}
          <p class="error">{reason}</p>
        {/each}
      </div>
    </section>
  {/if}

  {#if form?.message}<p class="error spaced">{form.message}</p>{/if}
  {#if form?.sent}<p class="success spaced">Mail server accepted {form.sent} due email{form.sent === 1 ? '' : 's'}.</p>{/if}
</section>

<section class="band">
  <div class="section-heading compact">
    <div>
      <p class="eyebrow">Campaigns</p>
      <h2>Recent schedules</h2>
    </div>
    <a class="button-link" href="/campaigns">Manage campaigns</a>
  </div>
  <div class="list">
    {#each data.campaigns as campaign}
      <article class="row-card">
        <div>
          <strong>{campaign.name}</strong>
          <p>{campaign.courseName} · {campaign.templateName} · Sends {formatDateTime(campaign.scheduledFor)}</p>
        </div>
        <span class:good={campaign.approved} class="pill">{campaign.approved ? 'Approved' : 'Draft'}</span>
      </article>
    {:else}
      <p class="empty">No campaigns scheduled.</p>
    {/each}
  </div>
</section>
