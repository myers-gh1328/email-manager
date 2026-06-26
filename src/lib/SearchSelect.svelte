<script lang="ts">
  interface SearchOption {
    value: string;
    label: string;
  }

  let {
    name,
    label,
    options,
    placeholder = 'Search',
    required = false,
    value = '',
    addHref = '',
    addLabel = '',
    searchHref = ''
  }: {
    name: string;
    label: string;
    options: SearchOption[];
    placeholder?: string;
    required?: boolean;
    value?: string;
    addHref?: string;
    addLabel?: string;
    searchHref?: string;
  } = $props();

  let selectedValue = $state('');
  let initialized = $state(false);
  let search = $state('');
  let remoteOptions = $state<SearchOption[]>([]);
  let loading = $state(false);
  let searchError = $state('');
  let filteredOptions = $derived(
    searchHref && search.trim()
      ? remoteOptions
      : options.filter((option) => option.label.toLowerCase().includes(search.trim().toLowerCase()))
  );

  $effect(() => {
    if (!initialized) {
      selectedValue = value;
      initialized = true;
    }
  });

  $effect(() => {
    if (!searchHref || !search.trim()) {
      remoteOptions = [];
      searchError = '';
      loading = false;
      return;
    }

    const controller = new AbortController();
    loading = true;
    const timeout = window.setTimeout(async () => {
      searchError = '';
      try {
        const response = await fetch(`${searchHref}?q=${encodeURIComponent(search.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Search failed.');
        const payload = (await response.json()) as { options?: SearchOption[] };
        remoteOptions = payload.options ?? [];
      } catch (error) {
        if (!controller.signal.aborted) searchError = error instanceof Error ? error.message : 'Search failed.';
      } finally {
        if (!controller.signal.aborted) loading = false;
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  });
</script>

<div class="search-select">
  <div class="field-header">
    <label for={`${name}-search`}>{label}</label>
    {#if addHref && addLabel}<a class="button-link" href={addHref}>{addLabel}</a>{/if}
  </div>
  <input id={`${name}-search`} bind:value={search} placeholder={placeholder} />
  {#if loading}<p class="help-text">Searching...</p>{/if}
  {#if searchError}<p class="error">{searchError}</p>{/if}
  <select {name} bind:value={selectedValue} required={required}>
    <option value="">{placeholder}</option>
    {#each filteredOptions as option}
      <option value={option.value}>{option.label}</option>
    {:else}
      <option value="" disabled>No options match that search.</option>
    {/each}
  </select>
</div>
