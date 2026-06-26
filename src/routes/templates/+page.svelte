<script lang="ts">
	  import { enhance } from '$app/forms';
	  import BusyOverlay from '$lib/BusyOverlay.svelte';
	  import EmailBodyEditor from '$lib/EmailBodyEditor.svelte';
	  import { classTemplateTokens, tokenFields } from '$lib/shared/template-fields';

	  let { data, form } = $props();
	  let drafting = $state(false);
	  let aiPrompt = $state('');
	  let templatesSearch = $derived(data.templatesPage.search ?? '');
	  let currentTemplatesPage = $derived(Math.floor(data.templatesPage.offset / data.templatesPage.limit) + 1);
	  let totalTemplatesPages = $derived(Math.max(Math.ceil(data.templatesPage.total / data.templatesPage.limit), 1));
	  let templateListReturnTo = $derived(templatesPageHref(currentTemplatesPage));
	  let templatesClearHref = $derived(data.returnTo ? `/templates?returnTo=${encodeURIComponent(data.returnTo)}` : '/templates');
	  let templateWorkflowReturnTo = $derived(data.returnTo || templateListReturnTo);
	  const variableFields = tokenFields(classTemplateTokens);

  function confirmDelete() {
    return confirm('Delete this template? This cannot be undone.');
  }

  function draftWithAi({ submitter }: { submitter: HTMLElement | null }) {
    const isAiSubmit = submitter instanceof HTMLButtonElement && submitter.formAction.includes('/aiDraft');
    if (isAiSubmit) drafting = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      try {
        await update();
      } finally {
        if (isAiSubmit) drafting = false;
      }
    };
  }

  function templatesPageHref(page: number) {
    const params = new URLSearchParams();
    if (data.returnTo) params.set('returnTo', data.returnTo);
    if (data.templatesPage.search) params.set('search', data.templatesPage.search);
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return query ? `/templates?${query}` : '/templates';
  }
</script>

<svelte:head>
  <title>Templates · Training Communications Studio</title>
</svelte:head>

<section class="band">
  <div>
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">Templates</p>
        <h2>Email templates</h2>
      </div>
    </div>
    <div class="action-row">
      <a class:active={data.action === 'create'} class="button-link" href={`/templates?action=create&returnTo=${encodeURIComponent(templateListReturnTo)}`}>Create template</a>
      <a class:active={data.action === 'ai'} class="button-link" href={`/templates?action=ai&returnTo=${encodeURIComponent(templateListReturnTo)}`}>AI draft</a>
    </div>
    {#if form?.message}<p class={form.message.includes('cannot') ? 'error spaced' : 'success spaced'}>{form.message}</p>{/if}
    <form class="inline-filters" method="GET" action="/templates">
      {#if data.returnTo}<input name="returnTo" type="hidden" value={data.returnTo} />{/if}
      <label>
        Search templates
        <input name="search" value={templatesSearch} placeholder="Name, subject, or body" />
      </label>
      <button type="submit">Search</button>
      {#if data.templatesPage.search}<a class="button-link" href={templatesClearHref}>Clear</a>{/if}
    </form>
    <p class="help-text">Showing {data.templates.length} of {data.templatesPage.total} templates.</p>
    <div class="list">
      {#each data.templates as template}
        <article class="row-card tall">
          <div>
            <strong>{template.name}</strong>
            <p class="template-subject">{template.subject}</p>
            <p class="muted-preview">{template.body}</p>
          </div>
          <a class="button-link" href={`/templates?templateId=${template.id}&returnTo=${encodeURIComponent(templateListReturnTo)}`}>Edit</a>
        </article>
      {:else}
        <p class="empty">No templates yet.</p>
      {/each}
    </div>
    {#if totalTemplatesPages > 1}
      <nav class="pagination" aria-label="Template pages">
        <a class="button-link" aria-disabled={currentTemplatesPage === 1} href={templatesPageHref(Math.max(currentTemplatesPage - 1, 1))}>Previous</a>
        <span>Page {currentTemplatesPage} of {totalTemplatesPages}</span>
        <a
          class="button-link"
          aria-disabled={currentTemplatesPage >= totalTemplatesPages}
          href={templatesPageHref(Math.min(currentTemplatesPage + 1, totalTemplatesPages))}
        >
          Next
        </a>
      </nav>
    {/if}
    <div class="form-stack task-stack">
    {#if data.selectedTemplate}
      {#if drafting}
        <BusyOverlay message="Drafting template..." />
      {/if}
      <form method="POST" action="?/updateTemplate" class="panel-form" data-local-busy use:enhance={draftWithAi}>
        <h3>Edit template</h3>
        <input name="templateId" type="hidden" value={data.selectedTemplate.id} />
        <label>Name<input name="name" value={data.selectedTemplate.name} required /></label>
        <label>Subject<input name="subject" value={data.selectedTemplate.subject} required /></label>
        <EmailBodyEditor name="body" rows={8} required value={data.selectedTemplate.body} fields={variableFields} />
        <label>AI instruction<textarea name="prompt" rows="3" placeholder="Make this shorter, warmer, and include the class start time."></textarea></label>
        <div class="button-row">
          <button type="submit">Update template</button>
          <button class="secondary" type="submit" formaction="?/aiDraft" formnovalidate disabled={!data.settings.aiEnabled || drafting}>
            {#if drafting}<span class="button-spinner" aria-hidden="true"></span>{/if}
            Reprompt AI
          </button>
          <a class="button-link" href={data.returnTo || '/templates'}>Cancel</a>
          <button class="danger" type="submit" formaction="?/deleteTemplate" onclick={confirmDelete}>Delete</button>
        </div>
      </form>
    {/if}
    {#if data.action === 'create'}
      {#if drafting}
        <BusyOverlay message="Drafting template..." />
      {/if}
      <form method="POST" action="?/createTemplate" class="panel-form" data-local-busy use:enhance={draftWithAi}>
        <h3>Create template</h3>
        {#if data.returnTo}<input type="hidden" name="returnTo" value={data.returnTo} />{/if}
        <label>Name<input name="name" placeholder="Welcome email" required /></label>
        <label>Subject<input name="subject" placeholder={'Welcome to {{courseName}}, {{firstName}}'} required /></label>
        <EmailBodyEditor name="body" rows={9} required placeholder={'Hi {{firstName}},'} fields={variableFields} />
        <label>AI instruction<textarea name="prompt" rows="3" placeholder="Draft a friendly welcome email for an upcoming class."></textarea></label>
        <div class="button-row">
          <button type="submit">Save template</button>
          <button class="secondary" type="submit" formaction="?action=create&/aiDraft" formnovalidate disabled={!data.settings.aiEnabled || drafting}>
            {#if drafting}<span class="button-spinner" aria-hidden="true"></span>{/if}
            Draft with AI
          </button>
          <a class="button-link" href={data.returnTo || '/templates'}>Cancel</a>
        </div>
      </form>
    {/if}
    {#if data.action === 'ai'}
      {#if drafting}
        <BusyOverlay message="Drafting template..." />
      {/if}
      <form method="POST" action="?action=ai&/aiDraft" class="panel-form" data-local-busy use:enhance={draftWithAi}>
        <h3>AI drafting</h3>
        <label>Prompt<textarea bind:value={aiPrompt} name="prompt" rows="3" placeholder="Write a friendly reminder for tomorrow's pool session."></textarea></label>
        <button type="submit" disabled={!data.settings.aiEnabled || drafting || !aiPrompt.trim()}>
          {#if drafting}<span class="button-spinner" aria-hidden="true"></span>{/if}
          {drafting ? 'Drafting with AI' : 'Draft with AI'}
        </button>
        {#if form?.message}<p class="error">{form.message}</p>{/if}
      </form>
      {#if form?.draft}
        <form method="POST" action={form.draft.templateId ? '?/updateTemplate' : '?/createTemplate'} class="panel-form draft-result" use:enhance={draftWithAi}>
          <h3>Edit AI draft</h3>
          {#if form.draft.templateId}<input name="templateId" type="hidden" value={form.draft.templateId} />{/if}
          {#if data.returnTo}<input type="hidden" name="returnTo" value={data.returnTo} />{/if}
          <label>Name<input name="name" value={form.draft.name} required /></label>
          <label>Subject<input name="subject" value={form.draft.subject} required /></label>
          <EmailBodyEditor name="body" rows={9} required value={form.draft.body} fields={variableFields} />
          <div class="button-row">
            <button type="submit">{form.draft.templateId ? 'Update template' : 'Save template'}</button>
            <a class="button-link" href={`/templates?action=ai&returnTo=${encodeURIComponent(templateWorkflowReturnTo)}`}>Discard draft</a>
          </div>
        </form>
      {/if}
      <div class="button-row">
        <a class="button-link" href={templateWorkflowReturnTo}>Cancel</a>
      </div>
    {/if}
    </div>
  </div>
</section>
