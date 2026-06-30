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
    searchHref = '',
    showSelected = true
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
    showSelected?: boolean;
  } = $props();

  let selectedValue = $state('');
  let initialized = $state(false);
  let search = $state('');
  let remoteOptions = $state<SearchOption[]>([]);
  let loading = $state(false);
  let searchError = $state('');
  let open = $state(false);
  let filteredOptions = $derived(
    searchHref && search.trim()
      ? remoteOptions
      : options.filter((option) => option.label.toLowerCase().includes(search.trim().toLowerCase()))
  );
  let selectedOption = $derived(
    [...options, ...remoteOptions].find((option) => option.value === selectedValue)
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

  function selectOption(option: SearchOption) {
    selectedValue = option.value;
    search = option.label;
    open = false;
  }

  function closeWhenLeaving(event: FocusEvent) {
    if (event.currentTarget instanceof HTMLElement && event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    open = false;
  }
</script>

<div class="search-select" onfocusin={() => (open = true)} onfocusout={closeWhenLeaving}>
  <div class="field-header">
    <label for={`${name}-search`}>{label}</label>
    {#if addHref && addLabel}<a class="button-link" href={addHref}>{addLabel}</a>{/if}
  </div>
  <input
    id={`${name}-search`}
    bind:value={search}
    placeholder={placeholder}
    autocomplete="off"
    aria-expanded={open}
    aria-controls={`${name}-options`}
    oninput={() => (open = true)}
  />
  <input type="hidden" {name} value={selectedValue} />
  {#if showSelected && selectedOption}<p class="help-text">Selected: {selectedOption.label}</p>{/if}
  {#if loading}<p class="help-text">Searching...</p>{/if}
  {#if searchError}<p class="error">{searchError}</p>{/if}
  {#if open}
    <div id={`${name}-options`} class="option-list" role="listbox" aria-label={label} aria-required={required}>
      {#each filteredOptions as option}
        <button
          type="button"
          class:selected={option.value === selectedValue}
          role="option"
          aria-selected={option.value === selectedValue}
          onclick={() => selectOption(option)}
        >
          {option.label}
        </button>
      {:else}
        <p class="empty">No options match that search.</p>
      {/each}
    </div>
  {/if}
</div>

<style>
  .search-select {
    position: relative;
  }

  .option-list {
    position: absolute;
    z-index: 20;
    inset-inline: 0;
    display: grid;
    gap: 6px;
    margin-top: 6px;
    padding: 8px;
    max-height: 260px;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    box-shadow: var(--shadow-panel);
  }

  .option-list button {
    justify-content: flex-start;
    text-align: left;
  }

  .option-list button.selected {
    background: var(--brand);
    color: white;
  }
</style>
