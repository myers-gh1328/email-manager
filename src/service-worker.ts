/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';
import { installPwaUpdateHandler } from '@myers-gh1328/pwa-lifecycle';

const cacheName = `training-communications-studio-${version}`;
const cachedAssets = [...build, ...files];
const workerScope = globalThis as ServiceWorkerGlobalScope;
const cachedAssetPaths = new Set(cachedAssets.map((asset) => new URL(asset, workerScope.location.origin).pathname));

installPwaUpdateHandler(workerScope);

globalThis.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(cacheName).then((cache) => {
      return cache.addAll(cachedAssets);
    })
  );
});

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)));
    })
  );
});

globalThis.addEventListener('fetch', (event) => {
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
