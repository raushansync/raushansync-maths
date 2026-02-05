/* RaushanSYNC Maths PWA Service Worker */
const CACHE_VERSION = 'maths-v1.0.0';
const CORE_CACHE = 'rs-core-' + CACHE_VERSION;
const RUNTIME_CACHE = 'rs-runtime-' + CACHE_VERSION;
const OFFLINE_URL = '/offline.html';
const MAX_RUNTIME_ENTRIES = 60;

const CORE_ASSETS = [
  '/',
  '/index.html',
  OFFLINE_URL,
  '/manifest.json',
  '/assets/css/style.css',
  '/assets/js/script.js',
  '/components/nav.html',
  '/components/footer.html',
  '/components/support-cta.html',
  '/favicon.ico',
  '/favicon-48x48.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/about.html',
  '/class06/index.html',
  '/class07/index.html',
  '/class08/index.html',
  '/class09/index.html',
  '/class10/index.html',
  '/class11/index.html',
  '/class12/index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    await cache.addAll(CORE_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => ![CORE_CACHE, RUNTIME_CACHE].includes(key))
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

function isNotesOrPractice(pathname) {
  return pathname.startsWith('/notes/')
    || pathname.startsWith('/practice/')
    || pathname.startsWith('/practice-advanced/');
}

function isComponent(pathname) {
  return pathname.startsWith('/components/');
}

function isStaticAsset(request, pathname) {
  if (pathname.startsWith('/assets/')) return true;
  if (request.destination) {
    return ['style', 'script', 'image', 'font'].includes(request.destination);
  }
  return false;
}

function shouldCacheResponse(response) {
  return response && response.status === 200 && response.type === 'basic';
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await cache.delete(keys[0]);
  if (keys.length - 1 > maxEntries) {
    return trimCache(cacheName, maxEntries);
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (shouldCacheResponse(response)) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
      trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
    }
    return response;
  } catch (error) {
    if (request.destination === 'document') {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
    }
    throw error;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (shouldCacheResponse(response)) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
      trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.destination === 'document') {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;

  if (isStaticAsset(request, pathname) || isComponent(pathname) || isNotesOrPractice(pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
