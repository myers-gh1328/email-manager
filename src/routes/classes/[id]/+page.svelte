<script lang="ts">
	  import { enhance } from '$app/forms';
	  import BusyOverlay from '$lib/BusyOverlay.svelte';
	  import ContactMultiSelect from '$lib/ContactMultiSelect.svelte';
	  import SearchSelect from '$lib/SearchSelect.svelte';
	  import { formatClassSchedule, formatDateTime, purposeLabel, scheduledEmailDeliverySummary, timingLabel } from '$lib/shared/format';

  let { data, form } = $props();
  let importingImage = $state(false);
  let loadedSessionId = $state('');
  let editStartsOn = $state('');
  let editEndsOn = $state('');
  let editEndDateTouched = $state(false);
  let courseOptions = $derived(data.courseTypes.map((course) => ({ value: course.id, label: course.name })));
  let locationOptions = $derived(data.locations.map((location) => ({ value: location.id, label: location.name })));
  let templateOptions = $derived([
    ...data.defaultTemplates.map((item) => ({ value: `default:${item.purpose}:${item.templateId}`, label: `${purposeLabel(item.purpose)} · ${item.templateName} · ${timingLabel(item.sendOffsetMinutes)}` })),
    ...data.templateOptions
  ]);
  let aiImageImportReady = $derived(Boolean(data.settings.aiEnabled && data.settings.aiVisionEnabled && data.settings.aiBaseUrl && data.settings.aiModel));

  $effect(() => {
    if (loadedSessionId !== data.session.id) {
      loadedSessionId = data.session.id;
      editStartsOn = data.session.startsOn;
      editEndsOn = data.session.endsOn || data.session.startsOn;
      editEndDateTouched = false;
    }
    if (!editEndDateTouched) editEndsOn = editStartsOn;
  });

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

  function checklistForContact(contactId: string) {
    return data.checklistState.filter((item) => item.contactId === contactId);
  }
</script>

<svelte:head>
  <title>{data.session.courseName} · Class</title>
</svelte:head>

<section class="band two-column">
  <div>
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">Class roster</p>
        <h2>{data.session.courseName}</h2>
      </div>
      <a class="button-link" href="/classes">Back</a>
    </div>
    <p class="body-copy">{formatClassSchedule(data.session)} · {data.session.location}</p>
    {#if form?.message}<p class={form.error ? 'error spaced' : 'success spaced'}>{form.message}</p>{/if}
    <section class="panel-form spaced">
      <div class="section-heading compact">
        <div>
          <p class="eyebrow">Course scheduled emails</p>
          <h3>Emails added from course setup</h3>
        </div>
      </div>
      <p class="body-copy">These emails come from the course setup. Changing setup emails updates future unsent class emails while preserving emails already sent.</p>
      <div class="list">
        {#each data.defaultTemplates as defaultTemplate}
          <article class="row-card">
            <div>
              <strong>{purposeLabel(defaultTemplate.purpose)}</strong>
              <p>{defaultTemplate.templateName} · {timingLabel(defaultTemplate.sendOffsetMinutes)}</p>
            </div>
            <span class="pill">From course setup</span>
          </article>
        {:else}
          <p class="empty">No setup emails are configured for this course.</p>
        {/each}
      </div>
    </section>
    <section class="panel-form spaced">
      <div class="section-heading compact">
        <div>
          <p class="eyebrow">Scheduled emails</p>
          <h3>What will send for this class</h3>
        </div>
      </div>
      <div class="list">
        {#each data.scheduledCampaigns as campaign}
          <article class="row-card tall">
            <div>
              <a href={`/campaigns/${campaign.id}`}><strong>{campaign.name}</strong></a>
              <p>Sends {formatDateTime(campaign.scheduledFor)} · {campaign.templateName}</p>
              <p>
                {campaign.source === 'course_default' ? 'From course setup' : 'Manual schedule'}
                · {scheduledEmailDeliverySummary(campaign)}
              </p>
            </div>
            <span class:good={campaign.approved} class="pill">{campaign.approved ? 'Ready to send' : 'Draft'}</span>
          </article>
        {:else}
          <p class="empty">No emails are scheduled for this class yet.</p>
        {/each}
      </div>
    </section>
    <section class="spaced">
      <div class="section-heading compact">
        <div>
          <p class="eyebrow">Roster and prep</p>
          <h3>Students</h3>
        </div>
      </div>
      <div class="list">
      {#each data.roster as contact}
        {@const checklist = checklistForContact(contact.id)}
        <article class="row-card">
          <div>
            <strong>{contact.firstName} {contact.lastName}</strong>
            <p>{contact.email}</p>
            {#if checklist.length}
              <div class="student-prep-items" aria-label={`Prep items for ${contact.firstName} ${contact.lastName}`}>
                <p class="prep-label">Prep items</p>
                {#each checklist as item}
                  <form method="POST" action="?/toggleChecklistItem" use:enhance>
                    <input name="contactId" type="hidden" value={contact.id} />
                    <input name="itemScope" type="hidden" value={item.itemScope} />
                    <input name="itemId" type="hidden" value={item.itemId} />
                    <input name="completed" type="hidden" value={item.completed ? 'false' : 'true'} />
                    <button class:good={item.completed} class="checklist-toggle" type="submit">
                      <span aria-hidden="true">{item.completed ? '✓' : '□'}</span>
                      {item.label}
                    </button>
                  </form>
                {/each}
              </div>
            {/if}
          </div>
          <form method="POST" action="?/unenrollContact" use:enhance>
            <input name="contactId" type="hidden" value={contact.id} />
            <button class="secondary" type="submit">Unenroll</button>
          </form>
        </article>
      {:else}
        <p class="empty">No students enrolled.</p>
      {/each}
      </div>
    </section>
  </div>

  <div class="form-stack">
    <form method="POST" action="?/updateClassSession" class="panel-form" use:enhance>
      <h3>Edit class</h3>
      <SearchSelect
        name="courseTypeId"
        label="Course"
        options={courseOptions}
        value={data.session.courseTypeId}
        placeholder="Search courses"
        addHref="/settings"
        addLabel="Add course"
        required
      />
      <SearchSelect
        name="locationId"
        label="Location"
        options={locationOptions}
        value={data.session.locationId}
        placeholder="Search locations"
        addHref="/settings"
        addLabel="Add location"
        required
      />
      <label>Start date<input bind:value={editStartsOn} name="startsOn" type="date" required /></label>
      <label>End date<input bind:value={editEndsOn} name="endsOn" type="date" oninput={() => (editEndDateTouched = true)} required /></label>
      <label>Start time<input name="startTime" type="time" value={data.session.startTime} /></label>
      <label>Notes<textarea name="notes" rows="3">{data.session.notes}</textarea></label>
      <button type="submit">Update class</button>
    </form>
    <form method="POST" action="?/enrollContact" class="panel-form" use:enhance>
      <h3>Add student</h3>
      <ContactMultiSelect contacts={data.contactOptions} name="contactId" legend="Student" mode="single" />
      <button type="submit">Enroll</button>
    </form>
    <details class="action-panel" open={form?.panel === 'email'}>
      <summary>Email this class</summary>
      <form method="POST" action="?/previewClassEmail" class="panel-form" use:enhance>
        <SearchSelect
          name="emailChoice"
          label="Template"
          options={templateOptions}
          value={form?.emailChoice ?? ''}
          placeholder="Choose email template"
          addHref="/templates?action=create"
          addLabel="Add template"
          searchHref="/templates/search"
          required
        />
        <button type="submit">Preview student emails</button>
      </form>
      {#if form?.previews}
        <section class="panel-form">
          <h3>Preview</h3>
          <p class="body-copy">Will schedule {form.previews.filter((preview) => !preview.skipped).length} private emails, one to each student. Students will not see each other.</p>
          <div class="list">
            {#each form.previews as preview}
              <article class="row-card tall">
                <div>
                  <strong>{preview.contact.firstName} {preview.contact.lastName}</strong>
                  <p>{preview.subject}</p>
                  <p>{preview.body}</p>
                  {#if preview.missing.length}<p class="error">Missing: {preview.missing.join(', ')}</p>{/if}
                  {#if preview.skipped}<p class="error">Skipped: {preview.reason}</p>{/if}
                </div>
              </article>
            {/each}
          </div>
          <form method="POST" action="?/scheduleClassEmail" class="inline-edit-form" use:enhance>
            <input name="templateId" type="hidden" value={form.templateId} />
            <input name="defaultPurpose" type="hidden" value={form.defaultPurpose ?? ''} />
            <input name="defaultLabel" type="hidden" value={form.defaultLabel ?? ''} />
            <input name="sendOffsetMinutes" type="hidden" value={form.sendOffsetMinutes ?? ''} />
            <input name="previewToken" type="hidden" value={form.previewToken} />
            <label>Send at<input name="scheduledFor" type="datetime-local" value={form.suggestedScheduledFor ?? ''} required /></label>
            <button type="submit">Schedule individual emails</button>
          </form>
        </section>
      {/if}
    </details>
    <details class="action-panel">
      <summary>Import CSV roster</summary>
      <form method="POST" action="?/importCsv" enctype="multipart/form-data" class="panel-form" use:enhance>
        <a class="button-link" href="/classes/roster-template.csv">Download CSV template</a>
        <label>CSV file<input name="csvFile" type="file" accept=".csv,text/csv" required /></label>
        <button type="submit">Import CSV</button>
      </form>
    </details>
    {#if aiImageImportReady}
      <details class="action-panel" open={form?.panel === 'image'}>
        <summary>Import roster photo</summary>
        {#if importingImage}<BusyOverlay message="Importing roster image..." />{/if}
        <form method="POST" action="?/importImage" enctype="multipart/form-data" class="panel-form" data-local-busy use:enhance={showImageImportBusy}>
          <label>Roster photo or image<input name="imageFile" type="file" accept="image/*" capture="environment" required /></label>
          <button type="submit" disabled={importingImage}>Extract students from image</button>
        </form>
      </details>
    {:else}
      <details class="action-panel">
        <summary>Import roster photo</summary>
        <section class="panel-form">
          <p class="body-copy">Connect AI assistance and choose a vision-capable model in Settings to import a roster photo or screenshot.</p>
        </section>
      </details>
    {/if}
  </div>
</section>

<style>
  .student-prep-items {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
  }

  .prep-label {
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 700;
    margin: 0 4px 0 0;
    text-transform: uppercase;
  }

  .checklist-toggle {
    min-height: 36px;
  }
</style>
