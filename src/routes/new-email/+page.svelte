<script lang="ts">
  import { enhance } from '$app/forms';
  import BusyOverlay from '$lib/BusyOverlay.svelte';
  import ContactMultiSelect from '$lib/ContactMultiSelect.svelte';
  import SearchSelect from '$lib/SearchSelect.svelte';
  import EmailBodyEditor from '$lib/EmailBodyEditor.svelte';
  import { directEmailTokens, tokenFields } from '$lib/shared/template-fields';

  let { data, form } = $props();
  let drafting = $state(false);

  let selectedContactIds = $derived(form?.selectedContactIds ?? (data.selectedContactId ? [data.selectedContactId] : []));
  let selectedTemplateId = $derived(form?.selectedTemplateId ?? '');
  let subject = $derived(form?.subject ?? data.prefillSubject ?? '');
  let body = $derived(form?.body ?? data.prefillBody ?? '');
  let previewToken = $derived(form?.previewToken ?? '');
  let newEmailReturnTo = $derived(form?.returnTo ?? data.returnTo ?? '');
  let templateOptions = $derived(data.templateOptions);
  let newEmailWorkflowReturnTo = $derived(composeWorkflowReturnTo());
  let addContactHref = $derived(`/contacts?action=add&returnTo=${encodeURIComponent(newEmailWorkflowReturnTo)}`);
  let addTemplateHref = $derived(`/templates?action=create&returnTo=${encodeURIComponent(newEmailWorkflowReturnTo)}`);
  const variableFields = tokenFields(directEmailTokens);

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

  function composeWorkflowReturnTo() {
    const params = new URLSearchParams();
    if (selectedContactIds[0]) params.set('contactId', selectedContactIds[0]);
    if (subject) params.set('subject', subject);
    if (body) params.set('body', body);
    if (newEmailReturnTo) params.set('returnTo', newEmailReturnTo);
    const query = params.toString();
    return query ? `/new-email?${query}` : '/new-email';
  }
</script>

<svelte:head>
  <title>New Email · Training Communications Studio</title>
</svelte:head>

<section class="band">
  <div>
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">New Email</p>
        <h2>Write a new email</h2>
      </div>
      <a class="button-link" href={newEmailReturnTo || '/history'}>Back to History</a>
    </div>

    {#if form?.previews}
      <div class="preview-list">
        <h3>Email preview</h3>
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
  </div>

  {#if drafting}
    <BusyOverlay message="Drafting message..." />
  {/if}
  <form method="POST" action="?/previewDirectEmail" class="panel-form" data-local-busy use:enhance={draftWithAi}>
    <h3>Email details</h3>
    <ContactMultiSelect contacts={data.contactOptions} {selectedContactIds} addHref={addContactHref} addLabel="Add contact" />

    <SearchSelect
      name="templateId"
      label="Template"
      options={templateOptions}
      value={selectedTemplateId}
      placeholder="Search templates"
      addHref={addTemplateHref}
      addLabel="Add template"
      searchHref="/templates/search"
    />
    <button class="secondary" type="submit" formaction="?/loadTemplate">Load template</button>
    <label>Subject<input name="subject" value={subject} placeholder="Quick class update" /></label>
    <EmailBodyEditor name="body" rows={10} placeholder={'Hi {{firstName}},'} value={body} fields={variableFields} />
    <label>AI instruction<textarea name="prompt" rows="3" placeholder="Write a concise one-time update about tonight's pool session."></textarea></label>
    <input name="previewToken" type="hidden" value={previewToken} />
    {#if newEmailReturnTo}<input name="returnTo" type="hidden" value={newEmailReturnTo} />{/if}

    {#if form?.message && !form?.previews}<p class={form.error ? 'error' : 'success'}>{form.message}</p>{/if}

    <div class="button-row">
      <button type="submit">Preview email</button>
      <button class="secondary" type="submit" formaction="?/aiDraftDirectEmail" formnovalidate disabled={!data.settings?.aiEnabled || drafting}>
        {#if drafting}<span class="button-spinner" aria-hidden="true"></span>{/if}
        Draft with AI
      </button>
      <button type="submit" formaction="?/sendDirectEmail" disabled={!previewToken}>Send previewed email</button>
    </div>
  </form>
</section>
