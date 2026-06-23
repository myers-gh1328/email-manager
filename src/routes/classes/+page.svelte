<script lang="ts">
  import { enhance } from '$app/forms';
  import SearchSelect from '$lib/SearchSelect.svelte';

  let { data, form } = $props();
  let newClassStartsOn = $state('');
  let newClassEndsOn = $state('');
  let endDateTouched = $state(false);
  let courseOptions = $derived(data.courseTypes.map((course) => ({ value: course.id, label: course.name })));
  let locationOptions = $derived(data.locations.map((location) => ({ value: location.id, label: location.name })));
  let templateOptions = $derived(data.templates.map((template) => ({ value: template.id, label: template.name })));
  let classOptions = $derived(
    data.classSessions.map((session) => ({ value: session.id, label: `${session.courseName} · ${formatClassSchedule(session)}` }))
  );
  let contactOptions = $derived(
    data.contacts.map((contact) => ({ value: contact.id, label: `${contact.firstName} ${contact.lastName} · ${contact.email}` }))
  );

  $effect(() => {
    if (!endDateTouched) newClassEndsOn = newClassStartsOn;
  });

  function formatClassSchedule(session: { startsOn: string; endsOn?: string; startTime?: string }) {
    const endsOn = session.endsOn || session.startsOn;
    const dateRange = endsOn !== session.startsOn ? `${session.startsOn} - ${endsOn}` : session.startsOn;
    return session.startTime ? `${dateRange} · ${session.startTime}` : dateRange;
  }

  function defaultTemplateValue(purpose: string) {
    return data.selectedCourseDefaults.find((item) => item.purpose === purpose && !item.label)?.templateId ?? '';
  }

  function defaultTiming(purpose: string) {
    const minutes = data.selectedCourseDefaults.find((item) => item.purpose === purpose && !item.label)?.sendOffsetMinutes ?? 0;
    const absolute = Math.abs(minutes);
    return {
      direction: minutes > 0 ? 'after' : 'before',
      unit: absolute > 0 && absolute % (24 * 60) !== 0 ? 'hours' : 'days',
      value: absolute > 0 && absolute % (24 * 60) !== 0 ? absolute / 60 : absolute / (24 * 60)
    };
  }

  const defaultEmailPurposes = [
    { key: 'welcome', label: 'Welcome' },
    { key: 'reminder', label: 'Reminder' },
    { key: 'pre_class_details', label: 'Pre-class details' },
    { key: 'follow_up', label: 'Follow-up' }
  ];
</script>

<svelte:head>
  <title>Classes · Training Communications Studio</title>
</svelte:head>

<section class="band two-column">
  <div>
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">Classes</p>
        <h2>Course types and scheduled classes</h2>
      </div>
      <a class="button-link" href="/classes/roster-template.csv">Download CSV template</a>
    </div>
    {#if form?.message}<p class="success spaced">{form.message}</p>{/if}
    <div class="tabs" aria-label="Class management views">
      <a class:active={data.tab === 'sessions'} href="/classes?tab=sessions">Scheduled classes</a>
      <a class:active={data.tab === 'courses'} href="/classes?tab=courses">Course types</a>
      <a class:active={data.tab === 'locations'} href="/classes?tab=locations">Locations</a>
    </div>
    <div class="action-row">
      {#if data.tab === 'courses'}
        <a class:active={data.action === 'course'} class="button-link" href="/classes?tab=courses&action=course">Add course type</a>
      {:else if data.tab === 'locations'}
        <a class:active={data.action === 'location'} class="button-link" href="/classes?tab=locations&action=location">Add location</a>
      {:else}
        <a class:active={data.action === 'session'} class="button-link" href="/classes?tab=sessions&action=session">Add class</a>
        <a class:active={data.action === 'enroll'} class="button-link" href="/classes?tab=sessions&action=enroll">Enroll student</a>
      {/if}
    </div>
    <section class="panel-form">
      <h3>Checklist defaults</h3>
      <div class="list">
        {#each data.checklistItems as item}
          <article class="row-card tall">
            <form method="POST" action="?/updateChecklistItem" class="inline-edit-form" use:enhance>
              <input name="itemId" type="hidden" value={item.id} />
              <label>Item<input name="label" value={item.label} required /></label>
              <button type="submit">Save</button>
            </form>
            <form method="POST" action="?/deleteChecklistItem" use:enhance>
              <input name="itemId" type="hidden" value={item.id} />
              <button class="secondary" type="submit">Delete</button>
            </form>
          </article>
        {:else}
          <p class="empty">No global checklist items yet.</p>
        {/each}
      </div>
      <form method="POST" action="?/createChecklistItem" class="inline-edit-form" use:enhance>
        <label>New item<input name="label" required /></label>
        <button type="submit">Add item</button>
      </form>
    </section>
    <div class="form-stack task-stack">
      {#if data.selectedCourse}
        <form method="POST" action="?/updateCourse" class="panel-form" use:enhance>
          <h3>Edit course type</h3>
          <input name="courseId" type="hidden" value={data.selectedCourse.id} />
          <label>Name<input name="name" value={data.selectedCourse.name} required /></label>
          <label>Description<textarea name="description" rows="3">{data.selectedCourse.description}</textarea></label>
          <div class="button-row">
            <button type="submit">Update course</button>
            <a class="button-link" href="/classes?tab=courses">Cancel</a>
          </div>
        </form>
        <section class="panel-form">
          <h3>Additional checklist items</h3>
          <div class="list">
            {#each data.selectedCourseChecklistItems as item}
              <article class="row-card tall">
                <form method="POST" action="?/updateCourseTypeChecklistItem" class="inline-edit-form" use:enhance>
                  <input name="itemId" type="hidden" value={item.id} />
                  <label>Item<input name="label" value={item.label} required /></label>
                  <button type="submit">Save</button>
                </form>
                <form method="POST" action="?/deleteCourseTypeChecklistItem" use:enhance>
                  <input name="itemId" type="hidden" value={item.id} />
                  <button class="secondary" type="submit">Delete</button>
                </form>
              </article>
            {:else}
              <p class="empty">No additional checklist items for this course type.</p>
            {/each}
          </div>
          <form method="POST" action="?/createCourseTypeChecklistItem" class="inline-edit-form" use:enhance>
            <input name="courseId" type="hidden" value={data.selectedCourse.id} />
            <label>New item<input name="label" required /></label>
            <button type="submit">Add course item</button>
          </form>
        </section>
        <form method="POST" action="?/saveCourseDefaults" class="panel-form" use:enhance>
          <h3>Default class emails</h3>
          <input name="courseId" type="hidden" value={data.selectedCourse.id} />
          {#each defaultEmailPurposes as purpose}
            {@const timing = defaultTiming(purpose.key)}
            <fieldset class="default-email-row">
              <legend>{purpose.label}</legend>
              <SearchSelect name={purpose.key} label="Template" options={templateOptions} value={defaultTemplateValue(purpose.key)} placeholder="Choose template" />
              <div class="split timing-row">
                <label>
                  Send
                  <input name={`${purpose.key}OffsetValue`} type="number" min="0" step="1" value={timing.value} />
                </label>
                <div class="split compact-split">
                  <label>
                    Unit
                    <select name={`${purpose.key}OffsetUnit`}>
                      <option value="days" selected={timing.unit === 'days'}>days</option>
                      <option value="hours" selected={timing.unit === 'hours'}>hours</option>
                    </select>
                  </label>
                  <label>
                    When
                    <select name={`${purpose.key}OffsetDirection`}>
                      <option value="before" selected={timing.direction === 'before'}>before class starts</option>
                      <option value="after" selected={timing.direction === 'after'}>after class starts</option>
                    </select>
                  </label>
                </div>
              </div>
            </fieldset>
          {/each}
          <button type="submit">Save defaults</button>
        </form>
      {:else if data.selectedLocation}
        <form method="POST" action="?/updateLocation" class="panel-form" use:enhance>
          <h3>Edit location</h3>
          <input name="locationId" type="hidden" value={data.selectedLocation.id} />
          <label>Name<input name="name" value={data.selectedLocation.name} required /></label>
          <label>Address<textarea name="address" rows="3">{data.selectedLocation.address}</textarea></label>
          <div class="split">
            <label>Phone<input name="phone" value={data.selectedLocation.phone} /></label>
            <label>Website<input name="website" value={data.selectedLocation.website} /></label>
          </div>
          <label>Parking notes<textarea name="parkingNotes" rows="2">{data.selectedLocation.parkingNotes}</textarea></label>
          <label>Meeting instructions<textarea name="meetingInstructions" rows="3">{data.selectedLocation.meetingInstructions}</textarea></label>
          <label>Notes<textarea name="notes" rows="2">{data.selectedLocation.notes}</textarea></label>
          <div class="button-row">
            <button type="submit">Update location</button>
            <a class="button-link" href="/classes?tab=locations">Cancel</a>
          </div>
        </form>
      {:else if data.action === 'course'}
        <form method="POST" action="?/createCourse" class="panel-form" use:enhance>
          <h3>Add course type</h3>
          <label>Name<input name="name" placeholder="Open Water" required /></label>
          <label>Description<textarea name="description" rows="2"></textarea></label>
          <div class="button-row">
            <button type="submit">Add course</button>
            <a class="button-link" href="/classes?tab=courses">Cancel</a>
          </div>
        </form>
      {:else if data.action === 'location'}
        <form method="POST" action="?/createLocation" class="panel-form" use:enhance>
          <h3>Add location</h3>
          <label>Name<input name="name" placeholder="Dive shop" required /></label>
          <label>Address<textarea name="address" rows="3"></textarea></label>
          <div class="split">
            <label>Phone<input name="phone" /></label>
            <label>Website<input name="website" /></label>
          </div>
          <label>Parking notes<textarea name="parkingNotes" rows="2"></textarea></label>
          <label>Meeting instructions<textarea name="meetingInstructions" rows="3"></textarea></label>
          <label>Notes<textarea name="notes" rows="2"></textarea></label>
          <div class="button-row">
            <button type="submit">Add location</button>
            <a class="button-link" href="/classes?tab=locations">Cancel</a>
          </div>
        </form>
      {/if}
      {#if data.action === 'session'}
        <form method="POST" action="?/createClassSession" class="panel-form" use:enhance>
          <h3>Add class</h3>
          <SearchSelect name="courseTypeId" label="Course" options={courseOptions} placeholder="Search courses" required />
          <SearchSelect name="locationId" label="Location" options={locationOptions} placeholder="Search locations" required />
          <label>Start date<input bind:value={newClassStartsOn} name="startsOn" type="date" required /></label>
          <label>End date<input bind:value={newClassEndsOn} name="endsOn" type="date" oninput={() => (endDateTouched = true)} required /></label>
          <label>Start time<input name="startTime" type="time" /></label>
          <label>Notes<textarea name="notes" rows="2"></textarea></label>
          <div class="button-row">
            <button type="submit">Add class</button>
            <a class="button-link" href="/classes?tab=sessions">Cancel</a>
          </div>
        </form>
      {/if}
      {#if data.action === 'enroll'}
        <form method="POST" action="?/enrollContact" class="panel-form" use:enhance>
          <h3>Enroll student</h3>
          <SearchSelect name="classSessionId" label="Class" options={classOptions} placeholder="Search classes" required />
          <SearchSelect name="contactId" label="Contact" options={contactOptions} placeholder="Search contacts" required />
          <div class="button-row">
            <button type="submit">Enroll</button>
            <a class="button-link" href="/classes?tab=sessions">Cancel</a>
          </div>
        </form>
      {/if}
    </div>
    {#if data.tab === 'courses'}
      <div class="list">
        {#each data.courseTypes as course}
          <article class="row-card tall">
            <div>
              <strong>{course.name}</strong>
              {#if course.description}<p>{course.description}</p>{/if}
            </div>
            <a class="button-link" href={`/classes?tab=courses&courseId=${course.id}`}>Edit</a>
          </article>
        {:else}
          <p class="empty">No course types yet.</p>
        {/each}
      </div>
    {:else if data.tab === 'locations'}
      <div class="list">
        {#each data.locations as location}
          <article class="row-card tall">
            <div>
              <strong>{location.name}</strong>
              {#if location.address}<p>{location.address}</p>{/if}
              {#if location.phone || location.website}<p>{location.phone}{location.phone && location.website ? ' · ' : ''}{location.website}</p>{/if}
            </div>
            <a class="button-link" href={`/classes?tab=locations&locationId=${location.id}`}>Edit</a>
          </article>
        {:else}
          <p class="empty">No locations yet.</p>
        {/each}
      </div>
    {:else}
      <div class="list">
        {#each data.classSessions as session}
          <article class="row-card">
            <div>
              <a href={`/classes/${session.id}`}><strong>{session.courseName}</strong></a>
              <p>{formatClassSchedule(session)} · {session.location}</p>
            </div>
            <a class="button-link" href={`/classes/${session.id}`}>Roster / import</a>
          </article>
        {:else}
          <p class="empty">Create a scheduled class before importing a roster.</p>
        {/each}
      </div>
    {/if}
  </div>
</section>

<style>
  .default-email-row {
    display: grid;
    gap: 10px;
    margin: 0;
    border: 1px solid #d9e5e1;
    border-radius: 8px;
    padding: 12px;
  }

  .default-email-row legend {
    color: #24443f;
    font-weight: 850;
    padding: 0 4px;
  }

  .timing-row {
    align-items: end;
  }

  .compact-split {
    grid-template-columns: minmax(0, 0.75fr) minmax(0, 1.25fr);
  }

  @media (max-width: 720px) {
    .timing-row,
    .compact-split {
      grid-template-columns: 1fr;
    }
  }
</style>
