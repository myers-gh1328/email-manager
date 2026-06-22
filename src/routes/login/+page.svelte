<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();
</script>

<main class="auth-shell">
  <section class="auth-panel">
    <p class="eyebrow">Private instructor tool</p>
    <h1>Sign in</h1>
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
