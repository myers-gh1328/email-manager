<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
</script>

<main class="auth-shell">
  <section class="auth-panel">
    <p class="eyebrow">Private instructor tool</p>
    <h1>Sign in</h1>
    {#if data.externalError}
      <p class="error">That account is not linked to this app.</p>
    {/if}
    {#if data.externalSignOn.enabled}
      <a class="button-link full" href={`/auth/external/${data.externalSignOn.provider}/start?mode=login`}>
        Continue with {data.externalSignOn.providerLabel}
      </a>
    {/if}
    <form method="POST" class="stack" use:enhance>
      <label>
        Admin password
        <input name="password" type="password" required autocomplete="current-password" />
      </label>
      {#if form?.message}<p class="error">{form.message}</p>{/if}
      <button type="submit">Continue</button>
    </form>
  </section>
</main>
