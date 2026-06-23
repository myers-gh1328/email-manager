<script lang="ts">
  let { data } = $props();

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
</script>

<svelte:head>
  <title>Test audit · Training Communications Studio</title>
</svelte:head>

<section class="band">
  <div class="section-heading compact">
    <div>
      <p class="eyebrow">{data.settings.emailTestModeEnabled ? 'Email test mode' : 'Historical audit'}</p>
      <h2>{data.settings.emailTestModeEnabled ? 'Redirected email audit' : 'Past redirected test emails'}</h2>
    </div>
  </div>
  {#if !data.settings.emailTestModeEnabled}
    <p class="body-copy spaced">Email test mode is off. This page only shows historical redirects from earlier test-mode sends.</p>
  {/if}
  <div class="list">
    {#each data.audits as audit}
      <article class="row-card tall">
        <div>
          <strong>{audit.subject}</strong>
          <p>Intended recipient: {audit.originalRecipient}</p>
          <p>Test recipient: {audit.effectiveRecipient}</p>
          <p>Sent at: {formatDateTime(audit.createdAt)}</p>
        </div>
        <span class="pill warn">Test</span>
      </article>
    {:else}
      <p class="empty">No redirected test emails recorded yet.</p>
    {/each}
  </div>
</section>
