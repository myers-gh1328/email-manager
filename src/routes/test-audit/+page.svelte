<script lang="ts">
  let { data } = $props();
  let currentTestAuditPage = $derived(Math.floor(data.auditPage.offset / data.auditPage.limit) + 1);
  let totalTestAuditPages = $derived(Math.max(Math.ceil(data.auditPage.total / data.auditPage.limit), 1));

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function testAuditPageHref(page: number) {
    const params = new URLSearchParams();
    if (data.auditPage.search) params.set('search', data.auditPage.search);
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return query ? `/test-audit?${query}` : '/test-audit';
  }
</script>

<svelte:head>
  <title>Test Sends · Training Communications Studio</title>
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
  <form class="inline-filters" method="GET" action="/test-audit">
    <label>
      Search test sends
      <input name="search" value={data.auditPage.search} placeholder="Recipient or subject" />
    </label>
    <button type="submit">Search</button>
    {#if data.auditPage.search}<a class="button-link" href="/test-audit">Clear</a>{/if}
  </form>
  <p class="help-text">Showing {data.audits.length} of {data.auditPage.total} test sends.</p>
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
  {#if totalTestAuditPages > 1}
    <nav class="pagination" aria-label="Test send pages">
      <a class="button-link" aria-disabled={currentTestAuditPage === 1} href={testAuditPageHref(Math.max(currentTestAuditPage - 1, 1))}>Previous</a>
      <span>Page {currentTestAuditPage} of {totalTestAuditPages}</span>
      <a
        class="button-link"
        aria-disabled={currentTestAuditPage >= totalTestAuditPages}
        href={testAuditPageHref(Math.min(currentTestAuditPage + 1, totalTestAuditPages))}
      >
        Next
      </a>
    </nav>
  {/if}
</section>
