<script lang="ts">
  import { enhance } from '$app/forms';
	  import BusyOverlay from '$lib/BusyOverlay.svelte';
	  import SearchSelect from '$lib/SearchSelect.svelte';
	  import EmailBodyEditor from '$lib/EmailBodyEditor.svelte';
	  import { formatDateTime } from '$lib/shared/format';
	  import { directEmailTokens, tokenFields } from '$lib/shared/template-fields';

  let { data, form } = $props();
  let drafting = $state(false);

  let selectedContactIds = $derived(form?.selectedContactIds ?? (data.selectedContactId ? [data.selectedContactId] : []));
  let selectedTemplateId = $derived(form?.selectedTemplateId ?? '');
  let subject = $derived(form?.subject ?? '');
  let body = $derived(form?.body ?? '');
  let previewToken = $derived(form?.previewToken ?? '');
  let recipientSearch = $state('');
  let filteredContacts = $derived(
    data.contacts.filter((contact) =>
      `${contact.firstName} ${contact.lastName} ${contact.email}`.toLowerCase().includes(recipientSearch.toLowerCase())
    )
  );
  let templateOptions = $derived(data.templates.map((template) => ({ value: template.id, label: template.name })));
	  const variableFields = tokenFields(directEmailTokens);

  function isSelected(contactId: string) {
    return selectedContactIds.includes(contactId);
  }

	  function draftWithAi({ submitter }: { submitter: HTMLElement | null }) {
    const isAiSubmit = submitter instanceof HTMLButtonElement && submitter.formAction.includes('/aiDraftDirectEmail');
    if (isAiSubmit) drafting = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      try {
        await update();
      } finally {
        if (isAiSubmit) drafting = false;
      }
    };
  }
</script>

<svelte:head>
  <title>Communications · Training Communications Studio</title>
</svelte:head>

<section class="band two-column">
  <div>
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">Communications</p>
        <h2>Direct email composer</h2>
      </div>
    </div>

    {#if form?.message && form?.previews}<p class="success spaced">{form.message}</p>{/if}

    {#if form?.previews}
      <div class="preview-list">
        <h3>Preview</h3>
        {#each form.previews as preview}
          <article>
            <strong>{preview.contact.firstName} {preview.contact.lastName}</strong>
            <p>{preview.subject}</p>
            <pre>{preview.body}</pre>
            {#if preview.missing.length}<p class="error">Missing: {preview.missing.join(', ')}</p>{/if}
          </article>
        {/each}
      </div>
    {/if}

    <section class="panel-form spaced">
      <div class="section-heading compact">
        <div>
          <p class="eyebrow">History</p>
          <h3>Every recorded email</h3>
        </div>
      </div>
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
                {communication.source === 'campaign' ? 'Scheduled campaign' : 'Direct email'}
                {#if communication.testMode} · Test mode{/if}
                {#if communication.originalRecipient && communication.effectiveRecipient && communication.originalRecipient !== communication.effectiveRecipient}
                  · Intended for {communication.originalRecipient}
                {/if}
              </p>
              <p>{communication.body}</p>
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
    </section>
  </div>

  {#if drafting}
    <BusyOverlay message="Drafting message..." />
  {/if}
  <form method="POST" action="?/previewDirectEmail" class="panel-form" data-local-busy use:enhance={draftWithAi}>
    <h3>Compose email</h3>
    <fieldset class="contact-picker">
      <legend>Recipients</legend>
      <input bind:value={recipientSearch} placeholder="Search recipients" />
      {#each filteredContacts as contact}
        <label class="check">
          <input
            name="contactIds"
            type="checkbox"
            value={contact.id}
            checked={isSelected(contact.id)}
            disabled={contact.doNotEmail}
          />
          <span>
            {contact.firstName} {contact.lastName}
            <small>{contact.email}</small>
          </span>
          {#if contact.doNotEmail}<span class="pill warn">Do not email</span>{/if}
        </label>
      {:else}
        <p class="empty">{data.contacts.length ? 'No recipients match that search.' : 'Add contacts before sending direct email.'}</p>
      {/each}
    </fieldset>

    <SearchSelect name="templateId" label="Template" options={templateOptions} value={selectedTemplateId} placeholder="Search templates" />
    <button class="secondary" type="submit" formaction="?/loadTemplate">Load template</button>
    <label>Subject<input name="subject" value={subject} placeholder="Quick class update" /></label>
    <EmailBodyEditor name="body" rows={10} placeholder={'Hi {{firstName}},'} value={body} fields={variableFields} />
    <label>AI instruction<textarea name="prompt" rows="3" placeholder="Write a concise one-time update about tonight's pool session."></textarea></label>
    <input name="previewToken" type="hidden" value={previewToken} />

    {#if form?.message && !form?.previews}<p class={form.error ? 'error' : 'success'}>{form.message}</p>{/if}

    <div class="button-row">
      <button type="submit">Preview</button>
      <button class="secondary" type="submit" formaction="?/aiDraftDirectEmail" formnovalidate disabled={!data.settings?.aiEnabled || drafting}>
        {#if drafting}<span class="button-spinner" aria-hidden="true"></span>{/if}
        Draft with AI
      </button>
      <button type="submit" formaction="?/sendDirectEmail" disabled={!previewToken}>Send previewed email</button>
    </div>
  </form>
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

  @media (max-width: 720px) {
    .reply-card,
    .status-stack {
      align-items: stretch;
    }
  }
</style>
