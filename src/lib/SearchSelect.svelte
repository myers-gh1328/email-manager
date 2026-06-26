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
    addLabel = ''
  }: {
    name: string;
    label: string;
    options: SearchOption[];
    placeholder?: string;
    required?: boolean;
    value?: string;
    addHref?: string;
    addLabel?: string;
  } = $props();

  let selectedValue = $state('');
  let initialized = $state(false);
  let search = $state('');
  let filteredOptions = $derived(
    options.filter((option) => option.label.toLowerCase().includes(search.trim().toLowerCase()))
  );

  $effect(() => {
    if (!initialized) {
      selectedValue = value;
      initialized = true;
    }
  });
</script>

<div class="search-select">
  <div class="field-header">
    <label for={`${name}-search`}>{label}</label>
    {#if addHref && addLabel}<a class="button-link" href={addHref}>{addLabel}</a>{/if}
  </div>
  <input id={`${name}-search`} bind:value={search} placeholder={placeholder} />
  <select {name} bind:value={selectedValue} required={required}>
    <option value="">{placeholder}</option>
    {#each filteredOptions as option}
      <option value={option.value}>{option.label}</option>
    {:else}
      <option value="" disabled>No options match that search.</option>
    {/each}
  </select>
</div>
