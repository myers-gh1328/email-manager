<script lang="ts">
  import { enhance } from '$app/forms';
  import SearchSelect from '$lib/SearchSelect.svelte';

  let { data, form } = $props();
  let newClassStartsOn = $state('');
  let newClassEndsOn = $state('');
  let endDateTouched = $state(false);
  let courseOptions = $derived(data.courseTypes.map((course) => ({ value: course.id, label: course.name })));
  let locationOptions = $derived(data.locations.map((location) => ({ value: location.id, label: location.name })));

  $effect(() => {
    if (!endDateTouched) newClassEndsOn = newClassStartsOn;
  });

  function formatClassSchedule(session: { startsOn: string; endsOn?: string; startTime?: string }) {
    const endsOn = session.endsOn || session.startsOn;
    const dateRange = endsOn !== session.startsOn ? `${session.startsOn} - ${endsOn}` : session.startsOn;
    return session.startTime ? `${dateRange} · ${session.startTime}` : dateRange;
  }
</script>

<svelte:head>
  <title>Classes · Training Communications Studio</title>
</svelte:head>

<section class="band two-column">
  <div>
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">Classes</p>
        <h2>Scheduled classes</h2>
      </div>
      <a class="button-link" href="/classes?action=session">Add class</a>
    </div>
    {#if form?.message}<p class="success spaced">{form.message}</p>{/if}

    <div class="list">
      {#each data.classSessions as session}
        <article class="row-card">
          <div>
            <a href={`/classes/${session.id}`}><strong>{session.courseName}</strong></a>
            <p>{formatClassSchedule(session)} · {session.location}</p>
          </div>
          <a class="button-link" href={`/classes/${session.id}`}>Open class</a>
        </article>
      {:else}
        <p class="empty">Create a class before adding a roster.</p>
      {/each}
    </div>
  </div>

  <div class="form-stack">
    {#if data.action === 'session'}
      <form method="POST" action="?/createClassSession" class="panel-form" use:enhance>
        <h3>Add class</h3>
        <SearchSelect name="courseTypeId" label="Course" options={courseOptions} placeholder="Search courses" required />
        <SearchSelect name="locationId" label="Location" options={locationOptions} placeholder="Search locations" required />
        <p class="help-text"><a href="/settings">Manage class setup</a> for courses, locations, and defaults.</p>
        <label>Start date<input bind:value={newClassStartsOn} name="startsOn" type="date" required /></label>
        <label>End date<input bind:value={newClassEndsOn} name="endsOn" type="date" oninput={() => (endDateTouched = true)} required /></label>
        <label>Start time<input name="startTime" type="time" /></label>
        <label>Notes<textarea name="notes" rows="2"></textarea></label>
        <div class="button-row">
          <button type="submit">Add class</button>
          <a class="button-link" href="/classes">Cancel</a>
        </div>
      </form>
    {:else}
      <section class="panel-form">
        <h3>Class details</h3>
        <p class="empty">Select a class to manage its roster, requirements, and scheduled emails.</p>
      </section>
    {/if}
  </div>
</section>
