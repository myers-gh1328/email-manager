import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export function parseTrustedOrigins(value = '') {
  const origins = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      let url;
      try {
        url = new URL(entry);
      } catch {
        throw new Error('SCUBA_EMAIL_TRUSTED_ORIGINS must contain exact http or https origins.');
      }
      const normalizedEntry = entry.replace(/\/$/, '');
      const isExactOrigin =
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        normalizedEntry === url.origin;
      if (!isExactOrigin) {
        throw new Error('SCUBA_EMAIL_TRUSTED_ORIGINS must contain exact http or https origins.');
      }
      return url.origin;
    });
  return [...new Set(origins)];
}

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ out: process.env.SCUBA_BUILD_OUT ?? 'build' }),
    csrf: {
      trustedOrigins: parseTrustedOrigins(process.env.SCUBA_EMAIL_TRUSTED_ORIGINS)
    },
    serviceWorker: {
      register: false
    }
  }
};

export default config;
