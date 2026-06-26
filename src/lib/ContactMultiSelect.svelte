<script lang="ts">
  interface ContactOption {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    doNotEmail?: boolean;
  }

  let {
    contacts,
    selectedContactIds = [],
    name = 'contactIds',
    legend = 'Recipients',
    mode = 'multi'
  }: {
    contacts: ContactOption[];
    selectedContactIds?: string[];
    name?: string;
    legend?: string;
    mode?: 'multi' | 'single';
  } = $props();

  let search = $state('');
  let filteredContacts = $derived(
    contacts.filter((contact) =>
      `${contact.firstName} ${contact.lastName} ${contact.email}`.toLowerCase().includes(search.trim().toLowerCase())
    )
  );

  function isSelected(contactId: string) {
    return selectedContactIds.includes(contactId);
  }
</script>

<fieldset class="contact-picker">
  <legend>{legend}</legend>
  <label class="sr-only" for={`${name}-search`}>Search recipients</label>
  <input id={`${name}-search`} bind:value={search} placeholder="Search recipients" />
  {#if mode === 'multi'}
    <div class="selected-chip-row" aria-label="Selected recipients">
      {#each contacts.filter((contact) => isSelected(contact.id)) as contact}
        <span class="pill">{contact.firstName} {contact.lastName}</span>
      {/each}
    </div>
  {/if}
  {#each filteredContacts as contact}
    <label class="check">
      <input
        {name}
        type={mode === 'single' ? 'radio' : 'checkbox'}
        value={contact.id}
        checked={isSelected(contact.id)}
        disabled={contact.doNotEmail}
      />
      <span>
        {contact.firstName} {contact.lastName}
        <small>{contact.email}</small>
      </span>
      {#if contact.doNotEmail}<span class="pill warn">Do not email</span>{/if}
    </label>
  {:else}
    <p class="empty">{contacts.length ? 'No recipients match that search.' : 'Add contacts before sending direct email.'}</p>
  {/each}
</fieldset>

<style>
  .selected-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
</style>
