<script lang="ts">
  import { enhance } from '$app/forms';
  import BusyOverlay from '$lib/BusyOverlay.svelte';
  import { messageStatusLabel } from '$lib/shared/format';

  let { data, form } = $props();
  let importingImage = $state(false);
  let contactsSearch = $derived(data.contactsPage.search ?? '');
  let currentContactsPage = $derived(Math.floor(data.contactsPage.offset / data.contactsPage.limit) + 1);
  let totalContactsPages = $derived(Math.max(Math.ceil(data.contactsPage.total / data.contactsPage.limit), 1));

  function showImageImportBusy() {
    importingImage = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      try {
        await update();
      } finally {
        importingImage = false;
      }
    };
  }

  function activityDate(communication: { sentAt?: string; createdAt: string }) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(communication.sentAt || communication.createdAt)
    );
  }

  function formatClassSchedule(item: { startsOn: string; endsOn?: string; startTime?: string }) {
    const endsOn = item.endsOn || item.startsOn;
    const dateRange = endsOn !== item.startsOn ? `${item.startsOn} - ${endsOn}` : item.startsOn;
    return item.startTime ? `${dateRange} · ${item.startTime}` : dateRange;
  }

  function confirmDelete() {
    return confirm('Delete this contact and its local history? This cannot be undone.');
  }

  function contactsPageHref(page: number) {
    const params = new URLSearchParams();
    if (data.contactsPage.search) params.set('search', data.contactsPage.search);
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return query ? `/contacts?${query}` : '/contacts';
  }
</script>

<svelte:head>
  <title>Contacts · Training Communications Studio</title>
</svelte:head>

<section class="band">
  <div>
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">Contacts</p>
        <h2>Students and email recipients</h2>
      </div>
    </div>
    {#if form?.message}<p class={form.error ? 'error spaced' : 'success spaced'}>{form.message}</p>{/if}
    <div class="action-row">
      <a class:active={data.action === 'add'} class="button-link" href="/contacts?action=add">Add contact</a>
      <a class:active={data.action === 'import'} class="button-link" href="/contacts?action=import">Import contacts</a>
      <a class:active={data.action === 'image'} class="button-link" href="/contacts?action=image">Import screenshot</a>
    </div>
    <form class="inline-filters" method="GET" action="/contacts">
      <label>
        Search contacts
        <input name="search" value={contactsSearch} placeholder="Name, email, or phone" />
      </label>
      <button type="submit">Search</button>
      {#if data.contactsPage.search}<a class="button-link" href="/contacts">Clear</a>{/if}
    </form>
    <p class="help-text">Showing {data.contacts.length} of {data.contactsPage.total} contacts.</p>
    <div class="list">
      {#each data.contacts as contact}
        <article class="row-card tall">
          <div>
            <a href={`/contacts?contactId=${contact.id}`}><strong>{contact.firstName} {contact.lastName}</strong></a>
            <p>{contact.email}{contact.phone ? ` · ${contact.phone}` : ''}</p>
          </div>
          {#if contact.doNotEmail}<span class="pill warn">Do not email</span>{/if}
        </article>
      {:else}
        <p class="empty">No contacts yet.</p>
      {/each}
    </div>
    {#if totalContactsPages > 1}
      <nav class="pagination" aria-label="Contact pages">
        <a class="button-link" aria-disabled={currentContactsPage === 1} href={contactsPageHref(Math.max(currentContactsPage - 1, 1))}>Previous</a>
        <span>Page {currentContactsPage} of {totalContactsPages}</span>
        <a
          class="button-link"
          aria-disabled={currentContactsPage >= totalContactsPages}
          href={contactsPageHref(Math.min(currentContactsPage + 1, totalContactsPages))}
        >
          Next
        </a>
      </nav>
    {/if}
    <div class="form-stack task-stack">
      {#if data.action === 'add'}
        <form method="POST" action="?/createContact" class="panel-form" use:enhance>
          <h3>Add contact</h3>
          {#if data.returnTo}<input type="hidden" name="returnTo" value={data.returnTo} />{/if}
          <div class="split">
            <label>First name<input name="firstName" required /></label>
            <label>Last name<input name="lastName" required /></label>
          </div>
          <label>Email<input name="email" type="email" required /></label>
          <label>Phone<input name="phone" type="tel" autocomplete="tel" /></label>
          <label>Notes<textarea name="notes" rows="3"></textarea></label>
          <label class="check"><input name="doNotEmail" type="checkbox" /> Do not email</label>
          <div class="button-row">
            <button type="submit">Add contact</button>
            <a class="button-link" href="/contacts">Cancel</a>
          </div>
        </form>
      {/if}

      {#if data.action === 'import'}
        <form method="POST" action="?/importCsv" class="panel-form" enctype="multipart/form-data" use:enhance>
          <h3>Import contacts</h3>
          <a class="button-link" href="/classes/roster-template.csv">Download CSV template</a>
          <label>CSV file<input name="csvFile" type="file" accept=".csv,text/csv" required /></label>
          <div class="button-row">
            <button type="submit">Upload CSV</button>
            <a class="button-link" href="/contacts">Cancel</a>
          </div>
        </form>
      {/if}

      {#if data.action === 'image' && data.settings.aiEnabled && data.settings.aiVisionEnabled}
          {#if importingImage}<BusyOverlay message="Importing screenshot..." />{/if}
          <form method="POST" action="?action=image&/importImage" class="panel-form" enctype="multipart/form-data" data-local-busy use:enhance={showImageImportBusy}>
            <h3>Import screenshot</h3>
            <label>Image file<input name="imageFile" type="file" accept="image/*" required /></label>
            <div class="button-row">
              <button type="submit" disabled={importingImage}>Upload image</button>
              <a class="button-link" href="/contacts">Cancel</a>
            </div>
          </form>
      {:else if data.action === 'image'}
          <section class="panel-form">
            <h3>Import screenshot</h3>
            <p class="empty">Enable AI assistance and mark the model as vision-capable in settings to import students from an image.</p>
            <a class="button-link" href="/contacts">Cancel</a>
          </section>
      {/if}
    </div>

    {#if data.contactDetail}
      <div class="preview-list">
        <div class="section-heading compact">
          <div>
            <p class="eyebrow">Student record</p>
            <h3>{data.contactDetail.contact.firstName} {data.contactDetail.contact.lastName}</h3>
          </div>
        </div>

        <form method="POST" action="?/updateContact" class="panel-form" use:enhance>
          <input name="contactId" type="hidden" value={data.contactDetail.contact.id} />
          <div class="split">
            <label>First name<input name="firstName" value={data.contactDetail.contact.firstName} required /></label>
            <label>Last name<input name="lastName" value={data.contactDetail.contact.lastName} required /></label>
          </div>
          <label>Email<input name="email" type="email" value={data.contactDetail.contact.email} required /></label>
          <label>Phone<input name="phone" type="tel" autocomplete="tel" value={data.contactDetail.contact.phone} /></label>
          <label>Notes<textarea name="notes" rows="3">{data.contactDetail.contact.notes}</textarea></label>
          <label class="check"><input name="doNotEmail" type="checkbox" checked={data.contactDetail.contact.doNotEmail} /> Do not email</label>
          <div class="button-row">
            <button type="submit">Update contact</button>
            <button class="danger" type="submit" formaction="?/deleteContact" onclick={confirmDelete}>Delete contact</button>
          </div>
        </form>

        <section class="panel-form">
          <h3>Class history</h3>
          <div class="list">
            {#each data.contactDetail.classHistory as item}
              <article class="row-card">
                <div>
                  <strong>{item.courseName}</strong>
                  <p>{formatClassSchedule(item)} · {item.location}</p>
                </div>
              </article>
            {:else}
              <p class="empty">No class history yet.</p>
            {/each}
          </div>
        </section>

        <section class="panel-form">
          <div class="section-heading compact">
            <div>
              <h3>Recent emails</h3>
              <p class="help-text">Showing the 3 most recent messages for this person.</p>
            </div>
            <a class="button-link" href={`/communications?contactId=${data.contactDetail.contact.id}`}>View all in History</a>
          </div>
          <div class="list">
            {#each data.contactDetail.communications as communication}
              <article class="row-card tall">
                <div>
                  <a href={`/communications/${communication.id}`}><strong>{communication.subject}</strong></a>
                  <p>{activityDate(communication)} · {communication.source === 'campaign' ? 'Scheduled email' : 'Direct email'}</p>
                  {#if communication.replyCount}
                    <p>
                      {communication.replyCount} repl{communication.replyCount === 1 ? 'y' : 'ies'}
                      {#if communication.unreviewedReplyCount} · {communication.unreviewedReplyCount} Needs reply{/if}
                    </p>
                  {/if}
                  {#if communication.status === 'failed' && communication.errorMessage}
                    <p class="error">Error: {communication.errorMessage}</p>
                  {/if}
                </div>
                <span class:good={communication.status === 'accepted' || communication.status === 'sent'} class="pill">
                  {messageStatusLabel(communication.status)}
                </span>
              </article>
            {:else}
              <p class="empty">No recent emails recorded.</p>
            {/each}
          </div>
        </section>
      </div>
    {/if}
  </div>
</section>
