<script lang="ts">
  import { formatDateTime } from '$lib/shared/format';

  let { data } = $props();
  let dashboardReturnTo = $derived('/');
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
    <a href="/scheduled-emails"><span>{data.stats.campaigns}</span><p>Scheduled Emails</p></a>
  </div>

  <section class="panel-form spaced">
    <h3>Scheduled sending</h3>
    <div class="list">
      <div class="row-card">
        <div>
          <strong>{data.schedulerStatus.ready ? 'Automatic sending is ready' : 'Automatic sending needs setup'}</strong>
          <p>
            {data.schedulerStatus.dueReadyCount} scheduled email{data.schedulerStatus.dueReadyCount === 1 ? '' : 's'} ready to send
            {#if data.schedulerStatus.nextReady}
              · Next scheduled send: {data.schedulerStatus.nextReady.name} at {formatDateTime(data.schedulerStatus.nextReady.scheduledFor)}
            {:else}
              · No upcoming scheduled email ready to send
            {/if}
          </p>
        </div>
      </div>
    </div>

    <h3>Attention needed</h3>
    {#if !data.schedulerStatus.ready || (data.remoteStatus.enabled && !data.remoteStatus.ready)}
      <div class="list">
        {#each data.schedulerStatus.blockedReasons as reason}
          <a class="row-card" href="/settings">
            <strong>Email sending needs setup</strong>
            <p>{reason}</p>
          </a>
        {/each}
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
      <h2>Recent scheduled emails</h2>
    </div>
    <a class="button-link" href="/scheduled-emails">View scheduled emails</a>
  </div>
  <div class="list">
    {#each data.recentScheduledEmails as campaign}
      <a class="row-card" href={`/scheduled-emails/${campaign.id}?returnTo=${encodeURIComponent(dashboardReturnTo)}`}>
        <div>
          <strong>{campaign.name}</strong>
          <p>{campaign.courseName} · {campaign.templateName} · Sends {formatDateTime(campaign.scheduledFor)}</p>
        </div>
      </a>
    {:else}
      <p class="empty">No scheduled emails yet.</p>
    {/each}
  </div>
</section>
