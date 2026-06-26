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
    mode = 'multi',
    searchHref = '/contacts/search',
    addHref = '',
    addLabel = ''
  }: {
    contacts: ContactOption[];
    selectedContactIds?: string[];
    name?: string;
    legend?: string;
    mode?: 'multi' | 'single';
    searchHref?: string;
    addHref?: string;
    addLabel?: string;
  } = $props();

  let search = $state('');
  let selectedIds = $state<string[]>([]);
  let initializedSelection = $state(false);
  let remoteContacts = $state<ContactOption[]>([]);
  let loading = $state(false);
  let searchError = $state('');
  let filteredContacts = $derived(search.trim() ? remoteContacts : contacts);
  let knownContacts = $derived([...contacts, ...remoteContacts].reduce((byId, contact) => byId.set(contact.id, contact), new Map<string, ContactOption>()));
  let selectedContacts = $derived(selectedIds.map((contactId) => knownContacts.get(contactId)).filter((contact): contact is ContactOption => Boolean(contact)));

  $effect(() => {
    if (!initializedSelection) {
      selectedIds = [...selectedContactIds];
      initializedSelection = true;
    }
  });

  $effect(() => {
    if (!search.trim()) {
      remoteContacts = [];
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
        if (!response.ok) throw new Error('Contact search failed.');
        const payload = (await response.json()) as { contacts?: ContactOption[] };
        remoteContacts = payload.contacts ?? [];
      } catch (error) {
        if (!controller.signal.aborted) searchError = error instanceof Error ? error.message : 'Contact search failed.';
      } finally {
        if (!controller.signal.aborted) loading = false;
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  });

  function isSelected(contactId: string) {
    return selectedIds.includes(contactId);
  }

  function toggleContact(contactId: string, checked: boolean) {
    if (mode === 'single') {
      selectedIds = checked ? [contactId] : [];
      return;
    }
    selectedIds = checked
      ? [...new Set([...selectedIds, contactId])]
      : selectedIds.filter((selectedId) => selectedId !== contactId);
  }
</script>

<fieldset class="contact-picker">
  {#each selectedIds as contactId}
    <input type="hidden" {name} value={contactId} />
  {/each}
  <div class="field-header">
    <legend>{legend}</legend>
    {#if addHref && addLabel}<a class="button-link" href={addHref}>{addLabel}</a>{/if}
  </div>
  <label class="sr-only" for={`${name}-search`}>Search recipients</label>
  <input id={`${name}-search`} bind:value={search} placeholder="Search recipients" />
  {#if mode === 'multi'}
    <div class="selected-chip-row" aria-label="Selected recipients">
      {#each selectedContacts as contact}
        <span class="pill">{contact.firstName} {contact.lastName}</span>
      {/each}
    </div>
  {/if}
  {#if loading}<p class="help-text">Searching recipients...</p>{/if}
  {#if searchError}<p class="error">{searchError}</p>{/if}
  {#each filteredContacts as contact}
    <label class="check">
      <input
        type={mode === 'single' ? 'radio' : 'checkbox'}
        value={contact.id}
        checked={isSelected(contact.id)}
        disabled={contact.doNotEmail}
        onchange={(event) => toggleContact(contact.id, event.currentTarget.checked)}
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
