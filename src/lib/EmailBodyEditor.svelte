<script lang="ts">
  interface FieldToken {
    token: string;
    label?: string;
  }

  let {
    name,
    label = 'Body',
    value = '',
    rows = 9,
    placeholder = '',
    fields = [],
    required = false
  }: {
    name: string;
    label?: string;
    value?: string;
    rows?: number;
    placeholder?: string;
    fields?: FieldToken[];
    required?: boolean;
  } = $props();

  let body = $state('');
  let lastValue = $state('');
  let textarea: HTMLTextAreaElement;

  $effect(() => {
    if (value !== lastValue) {
      body = value;
      lastValue = value;
    }
  });

  function dragStart(event: DragEvent, token: string) {
    event.dataTransfer?.setData('text/plain', token);
  }

  function dropToken(event: DragEvent) {
    event.preventDefault();
    const token = event.dataTransfer?.getData('text/plain');
    if (!token) return;
    insertAtCursor(token);
  }

  function insertAtCursor(token: string) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    body = `${body.slice(0, start)}${token}${body.slice(end)}`;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = start + token.length;
      textarea.selectionEnd = start + token.length;
    });
  }
</script>

<section class="email-composer">
  <label>
    {label}
    <textarea
      bind:this={textarea}
      bind:value={body}
      {name}
      {rows}
      {placeholder}
      {required}
      ondragover={(event) => event.preventDefault()}
      ondrop={dropToken}
    ></textarea>
  </label>
  {#if fields.length}
    <div class="field-palette" aria-label="Template fields">
      {#each fields as field}
        <button
          class="field-token"
          type="button"
          draggable="true"
          aria-label={`Insert ${field.label ?? field.token} field`}
          onclick={() => insertAtCursor(field.token)}
          ondragstart={(event) => dragStart(event, field.token)}
        >
          {field.label ?? field.token}
        </button>
      {/each}
    </div>
  {/if}
</section>
