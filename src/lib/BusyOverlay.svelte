<script lang="ts">
  let { message = 'Working...' } = $props<{ message?: string }>();
</script>

<div class="busy-overlay" role="status" aria-live="polite" aria-label={message}>
  <div class="busy-dialog">
    <span class="busy-spinner" aria-hidden="true"></span>
    <strong>{message}</strong>
  </div>
</div>
