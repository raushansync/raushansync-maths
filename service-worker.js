/* RaushanSYNC Maths PWA Service Worker */
const CACHE_VERSION = 'maths-v1.1.1.4';
const CORE_CACHE = 'rs-core-' + CACHE_VERSION;
const RUNTIME_CACHE = 'rs-runtime-' + CACHE_VERSION;
const OFFLINE_URL = '/offline/';
const MAX_RUNTIME_ENTRIES = 60;

const SENSITIVE_DOCUMENT_PATHS = new Set([
  '/login',
  '/login/index.html',
  '/login.html',
  '/signup',
  '/signup/index.html',
  '/signup.html',
  '/dashboard',
  '/password-reset',
  '/password-reset/index.html',
  '/reset-confirmation',
  '/reset-confirmation/index.html'
]);

function normalizePathname(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) {
    return '/';
  }

  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function matchesPathPrefix(pathname, prefix) {
  if (prefix.endsWith('/')) {
    return pathname === prefix.slice(0, -1) || pathname.startsWith(prefix);
  }

  return pathname === prefix || pathname.startsWith(prefix + '/');
}

function isProtectedRoute(pathname) {
  const normalizedPath = normalizePathname(pathname);
  return matchesPathPrefix(normalizedPath, '/dashboard')
    || matchesPathPrefix(normalizedPath, '/password-reset')
    || matchesPathPrefix(normalizedPath, '/reset-confirmation');
}

function isSensitiveDocumentPath(pathname) {
  const normalizedPath = normalizePathname(pathname);
  return SENSITIVE_DOCUMENT_PATHS.has(normalizedPath) || isProtectedRoute(normalizedPath);
}

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/about/',
  '/about/index.html',
  '/account-deletion/',
  '/account-deletion/index.html',
  '/class06/',
  '/notes/class06/01-patterns-in-mathematics/',
  '/notes/class06/01-patterns-in-mathematics/index.html',
  '/notes/class06/01-patterns-in-mathematics/01_introduction_to_number_systems/',
  '/notes/class06/01-patterns-in-mathematics/01_introduction_to_number_systems/index.html',
  '/notes/class06/01-patterns-in-mathematics/02-introduction-to-number-systems/',
  '/notes/class06/01-patterns-in-mathematics/02-introduction-to-number-systems/index.html',
  '/notes/class06/01-patterns-in-mathematics/03-introduction-to-number-systems/',
  '/notes/class06/01-patterns-in-mathematics/03-introduction-to-number-systems/index.html',
  '/notes/class06/01-patterns-in-mathematics/04-whole-numbers/',
  '/notes/class06/01-patterns-in-mathematics/04-whole-numbers/index.html',
  '/notes/class06/01-patterns-in-mathematics/05-patterns-in-mathematics/',
  '/notes/class06/01-patterns-in-mathematics/05-patterns-in-mathematics/index.html',
  '/notes/class06/01-patterns-in-mathematics/06-patterns-in-mathematics/',
  '/notes/class06/01-patterns-in-mathematics/06-patterns-in-mathematics/index.html',
  '/class07/',
  '/class08/',
  '/class09/',
  '/class10/',
  '/class11/',
  '/class12/',
  '/future-content/',
  '/future-content/index.html',
  '/privacy/',
  '/privacy/index.html',
  '/terms/',
  '/terms/index.html',
  OFFLINE_URL,
  '/offline.html',
  '/offline/index.html',
  '/manifest.json',
  '/assets/css/style.css',
  '/assets/js/script.js',
  '/assets/js/homepage-hero.js',
  '/assets/js/auth-config.js',
  '/assets/js/auth-guard.js',
  '/assets/js/auth-logout-handler.js',
  '/assets/js/progress-tracker.js',
  '/assets/js/quiz-score-handler.js',
  '/assets/js/tick-manager.js',
  '/ai-chat.js',
  '/components/nav.html',
  '/components/footer.html',
  '/components/support-cta.html',
  '/notes/class06/01-patterns-in-mathematics/10_patterns_in_mathematics_successor_and_predecessor_in_number_line.png',
  '/notes/class06/01-patterns-in-mathematics/11_patterns_in_mathematics__arithematic_operations_on_number_line.png',
  '/notes/class06/01-patterns-in-mathematics/12_patterns_in_mathematics_some_number_sequence_examples.png',
  '/notes/class06/01-patterns-in-mathematics/13_patterns_in_mathematics__complete_graphs.png',
  '/notes/class06/01-patterns-in-mathematics/14_patterns_in_mathematics_stacked_squares.png',
  '/notes/class06/01-patterns-in-mathematics/15_patterns_in_mathematics__stacked_triangles.png',
  '/notes/class06/01-patterns-in-mathematics/16_patterns_in_mathematics_koch_snowflake.png',
  '/favicon.ico',
  '/favicon-48x48.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
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

function isStaticAsset(request, pathname) {
  if (pathname.startsWith('/assets/')) return true;
  if (request.destination) {
    return ['style', 'script', 'image', 'font'].includes(request.destination);
  }
  return false;
}

function isComponent(pathname) {
  return matchesPathPrefix(pathname, '/components');
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
      const offlineCompat = await caches.match('/offline.html');
      if (offlineCompat) return offlineCompat;
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
      const offlineCompat = await caches.match('/offline.html');
      if (offlineCompat) return offlineCompat;
    }
    throw error;
  }
}

async function networkOnlyDocument(request) {
  try {
    return await fetch(request, { cache: 'no-store' });
  } catch (error) {
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    const offlineCompat = await caches.match('/offline.html');
    if (offlineCompat) return offlineCompat;

    console.error(`Service Worker: Failed to fetch document at ${request.url}`, error);
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const pathname = normalizePathname(url.pathname);

  if (request.mode === 'navigate' || request.destination === 'document') {
    if (isSensitiveDocumentPath(pathname)) {
      event.respondWith(networkOnlyDocument(request));
      return;
    }

    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(request, pathname) || isComponent(pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
