	<script lang="ts">
	  import { formatDateTime } from '$lib/shared/format';

	  let { data } = $props();
	</script>

<svelte:head>
  <title>Dashboard · Training Communications Studio</title>
</svelte:head>

<section class="band">
  <div class="section-heading">
    <div>
      <p class="eyebrow">Overview</p>
      <h2>What needs attention today</h2>
    </div>
  </div>

  <div class="metric-grid">
    <a href="/contacts"><span>{data.stats.contacts}</span><p>Contacts</p></a>
    <a href="/classes"><span>{data.stats.classSessions}</span><p>Classes</p></a>
    <a href="/templates"><span>{data.stats.templates}</span><p>Templates</p></a>
    <a href="/campaigns"><span>{data.stats.pendingDeliveries}</span><p>Prepared scheduled emails</p></a>
  </div>

  <section class="panel-form spaced">
    <h3>Attention needed</h3>
    {#if !data.schedulerStatus.ready || data.failedTodayCount || (data.remoteStatus.enabled && !data.remoteStatus.ready)}
      <div class="list">
        {#each data.schedulerStatus.blockedReasons as reason}
          <a class="row-card" href="/settings">
            <strong>Email sending needs setup</strong>
            <p>{reason}</p>
          </a>
        {/each}
        {#if data.failedTodayCount}
          <a class="row-card" href="/communications?search=failed">
            <strong>Review failed emails</strong>
            <p>{data.failedTodayCount} email issue{data.failedTodayCount === 1 ? '' : 's'} need review before retrying.</p>
          </a>
        {/if}
        {#if data.remoteStatus.enabled && !data.remoteStatus.ready}
          {#each data.remoteStatus.blockedReasons as reason}
            <a class="row-card" href="/settings">
              <strong>Remote access needs setup</strong>
              <p>{reason}</p>
            </a>
          {/each}
        {/if}
      </div>
    {:else}
      <p class="success">No setup or sending issues need attention.</p>
    {/if}
  </section>
</section>

<section class="band">
  <div class="section-heading compact">
    <div>
      <p class="eyebrow">Scheduled Emails</p>
      <h2>Recent schedules</h2>
    </div>
    <a class="button-link" href="/campaigns">Manage scheduled emails</a>
  </div>
  <div class="list">
    {#each data.recentScheduledEmails as campaign}
      <a class="row-card" href={`/campaigns/${campaign.id}`}>
        <div>
          <strong>{campaign.name}</strong>
          <p>{campaign.courseName} · {campaign.templateName} · Sends {formatDateTime(campaign.scheduledFor)}</p>
        </div>
        <span class:good={campaign.approved} class="pill">{campaign.approved ? 'Scheduled' : 'Draft'}</span>
      </a>
    {:else}
      <p class="empty">No class emails scheduled.</p>
    {/each}
  </div>
</section>
