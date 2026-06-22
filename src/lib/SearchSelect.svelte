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
	    value = ''
	  }: {
	    name: string;
	    label: string;
	    options: SearchOption[];
	    placeholder?: string;
	    required?: boolean;
	    value?: string;
	  } = $props();

	  let selectedValue = $state('');
	  let initialized = $state(false);

	  $effect(() => {
	    if (!initialized) {
	      selectedValue = value;
	      initialized = true;
	    }
	  });
	</script>

	<label>
	  {label}
	  <select {name} bind:value={selectedValue} required={required}>
	    <option value="">{placeholder}</option>
	    {#each options as option}
	      <option value={option.value}>{option.label}</option>
	    {/each}
	  </select>
	</label>
