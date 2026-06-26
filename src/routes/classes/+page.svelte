<script lang="ts">
  import { enhance } from '$app/forms';
  import SearchSelect from '$lib/SearchSelect.svelte';

  let { data, form } = $props();
  let newClassStartsOn = $state('');
  let newClassEndsOn = $state('');
  let endDateTouched = $state(false);
  let courseOptions = $derived(data.courseTypes.map((course) => ({ value: course.id, label: course.name })));
  let locationOptions = $derived(data.locations.map((location) => ({ value: location.id, label: location.name })));
  let classesSearch = $derived(data.classSessionsPage.search ?? '');
  let currentClassesPage = $derived(Math.floor(data.classSessionsPage.offset / data.classSessionsPage.limit) + 1);
  let totalClassesPages = $derived(Math.max(Math.ceil(data.classSessionsPage.total / data.classSessionsPage.limit), 1));

  $effect(() => {
    if (!endDateTouched) newClassEndsOn = newClassStartsOn;
  });

  function formatClassSchedule(session: { startsOn: string; endsOn?: string; startTime?: string }) {
    const endsOn = session.endsOn || session.startsOn;
    const dateRange = endsOn !== session.startsOn ? `${session.startsOn} - ${endsOn}` : session.startsOn;
    return session.startTime ? `${dateRange} · ${session.startTime}` : dateRange;
  }

  function classesPageHref(page: number) {
    const params = new URLSearchParams();
    if (data.classSessionsPage.search) params.set('search', data.classSessionsPage.search);
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return query ? `/classes?${query}` : '/classes';
  }
</script>

<svelte:head>
  <title>Classes · Training Communications Studio</title>
</svelte:head>

<section class="band">
  <div>
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">Classes</p>
        <h2>Scheduled classes</h2>
      </div>
      <a class="button-link" href="/classes?action=session">Add class</a>
    </div>
    {#if form?.message}<p class="success spaced">{form.message}</p>{/if}

    <form class="inline-filters" method="GET" action="/classes">
      <label>
        Search classes
        <input name="search" value={classesSearch} placeholder="Course, location, or date" />
      </label>
      <button type="submit">Search</button>
      {#if data.classSessionsPage.search}<a class="button-link" href="/classes">Clear</a>{/if}
    </form>
    <p class="help-text">Showing {data.classSessions.length} of {data.classSessionsPage.total} classes.</p>

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
    {#if totalClassesPages > 1}
      <nav class="pagination" aria-label="Class pages">
        <a class="button-link" aria-disabled={currentClassesPage === 1} href={classesPageHref(Math.max(currentClassesPage - 1, 1))}>Previous</a>
        <span>Page {currentClassesPage} of {totalClassesPages}</span>
        <a
          class="button-link"
          aria-disabled={currentClassesPage >= totalClassesPages}
          href={classesPageHref(Math.min(currentClassesPage + 1, totalClassesPages))}
        >
          Next
        </a>
      </nav>
    {/if}
  </div>

  {#if data.action === 'session'}
    <div class="form-stack">
      <form method="POST" action="?/createClassSession" class="panel-form" use:enhance>
        <h3>Add class</h3>
        <SearchSelect
          name="courseTypeId"
          label="Course"
          options={courseOptions}
          placeholder="Search courses"
          addHref="/settings"
          addLabel="Add course"
          searchHref="/courses/search"
          required
        />
        <SearchSelect
          name="locationId"
          label="Location"
          options={locationOptions}
          placeholder="Search locations"
          addHref="/settings"
          addLabel="Add location"
          searchHref="/locations/search"
          required
        />
        <p class="help-text"><a href="/settings">Manage courses, locations, and prep tasks</a>.</p>
        <label>Start date<input bind:value={newClassStartsOn} name="startsOn" type="date" required /></label>
        <label>End date<input bind:value={newClassEndsOn} name="endsOn" type="date" oninput={() => (endDateTouched = true)} required /></label>
        <label>Start time<input name="startTime" type="time" /></label>
        <label>Notes<textarea name="notes" rows="2"></textarea></label>
        <div class="button-row">
          <button type="submit">Add class</button>
          <a class="button-link" href="/classes">Cancel</a>
        </div>
      </form>
    </div>
  {/if}
</section>
