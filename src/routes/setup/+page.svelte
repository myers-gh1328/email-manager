<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();
</script>

<main class="auth-shell">
  <section class="auth-panel">
    <p class="eyebrow">First run</p>
    <h1>Secure your training communications app</h1>
    <form method="POST" class="stack" use:enhance>
      <label>
        Admin password
        <input name="password" type="password" minlength="10" required autocomplete="new-password" />
      </label>
      {#if form?.message}<p class="error">{form.message}</p>{/if}
      <button type="submit">Create password</button>
    </form>
  </section>
</main>
