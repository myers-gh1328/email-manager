/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

const cacheName = `scuba-email-studio-${version}`;
const cachedAssets = [...build, ...files];
const cachedAssetPaths = new Set(cachedAssets.map((asset) => new URL(asset, self.location.origin).pathname));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(cacheName).then((cache) => {
      return cache.addAll(cachedAssets);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (!cachedAssetPaths.has(url.pathname)) return;

  event.respondWith(
    caches.match(url.pathname).then((cached) => {
      return cached ?? fetch(request);
    })
  );
});
