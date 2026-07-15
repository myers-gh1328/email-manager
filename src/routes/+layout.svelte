<script lang="ts">
  import '../styles.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import BusyOverlay from '$lib/BusyOverlay.svelte';
  import { initializePwaUpdates } from '$lib/pwa-updates';
  import { navigationItems } from '$lib/shared/navigation';

  let { data, children } = $props();
  let busy = $state(false);
  let navOpen = $state(false);
  let busyTimer: ReturnType<typeof setTimeout>;

  let navItems = $derived(navigationItems(data.settings));
  let themeMode = $derived(data.settings?.themeMode ?? 'system');
  let nextThemeMode = $derived(themeMode === 'dark' ? 'light' : 'dark');

  $effect(() => {
    if (browser) document.documentElement.dataset.theme = themeMode;
  });

  function isActiveNav(href: string) {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }

  function showBusy() {
    clearTimeout(busyTimer);
    busyTimer = setTimeout(() => {
      busy = true;
    }, 120);
  }

  function hideBusy() {
    clearTimeout(busyTimer);
    busy = false;
  }

  afterNavigate(() => {
    hideBusy();
    navOpen = false;
  });

  onMount(() => {
    let destroyed = false;
    let destroyPwaUpdates: (() => void) | undefined;
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target || target.download || target.origin !== window.location.origin) return;
      if (target.pathname === window.location.pathname && target.search === window.location.search) return;
      showBusy();
    };

    document.addEventListener('click', click, true);
    window.addEventListener('pageshow', hideBusy);
    hideBusy();
    void initializePwaUpdates()
      .then((updates) => {
        if (destroyed) updates.destroy();
        else destroyPwaUpdates = updates.destroy;
      })
      .catch(() => undefined);

    return () => {
      destroyed = true;
      destroyPwaUpdates?.();
      document.removeEventListener('click', click, true);
      window.removeEventListener('pageshow', hideBusy);
      clearTimeout(busyTimer);
    };
  });
	</script>

	<svelte:head>
	  <meta name="theme-color" content={themeMode === 'dark' ? '#101513' : '#f6f8f7'} />
	</svelte:head>

	{#if data.isAuthenticated}
  <div class="app-shell" data-theme={themeMode}>
    <aside class="sidebar" class:open={navOpen}>
      <div class="sidebar-heading">
        <div>
          <p class="eyebrow">Email operations</p>
          <h1>Training Communications Studio</h1>
        </div>
        <button
          class="secondary nav-toggle"
          type="button"
          aria-label={navOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={navOpen}
          aria-controls="primary-nav"
          onclick={() => (navOpen = !navOpen)}
        >
          <span aria-hidden="true"></span>
        </button>
      </div>
      <nav id="primary-nav">
        {#each navItems as item}
          <a href={item.href} class:active={isActiveNav(item.href)} aria-current={isActiveNav(item.href) ? 'page' : undefined}>{item.label}</a>
        {/each}
      </nav>
      <div class="sidebar-actions">
        <form method="POST" action="/theme">
          <input type="hidden" name="themeMode" value={nextThemeMode} />
          <button class="theme-toggle" type="submit" aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <span class="theme-toggle-icon" aria-hidden="true"></span>
            {themeMode === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </form>
        <form method="POST" action="/logout">
          <button class="secondary full" type="submit">Sign out</button>
        </form>
      </div>
    </aside>
    <main class="workspace" id="main-content">
      {#if data.settings?.emailTestModeEnabled}
        <div class="test-mode-banner">
          Email test mode is on. Outbound email is redirected to {data.settings.smtpFrom || 'the configured From address'}.
          No student email addresses will receive mail.
        </div>
      {/if}
      {#if busy}
        <BusyOverlay message="Working..." />
      {/if}
      {@render children()}
    </main>
  </div>
{:else}
  {@render children()}
{/if}
