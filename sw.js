// Service Worker for Photo Spectrum Gallery
// Version 1.4.3 — bump when clients should drop old CSS/JS/image caches

const CACHE_NAME = 'photo-spectrum-v1.4.3';
const STATIC_CACHE = 'photo-spectrum-static-v1.4.3';
const IMAGE_CACHE = 'photo-spectrum-images-v1.4.3';
const DATA_CACHE = 'photo-spectrum-data-v1.4.3';

const MAX_IMAGE_CACHE_SIZE = 100 * 1024 * 1024; // 100MB

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/gallery.html',
  '/about.html',
  '/music.html',
  '/projects.html',
  '/life-development.html',
  '/books.html',
  '/celeste-strawberry-guide.html',
  '/assets/css/styles.css',
  '/assets/css/resume.css',
  '/assets/resume/alex-diffor-graphic-communications.html',
  '/assets/resume/alex-diffor-engineering-technology.html',
  '/assets/images/about/diffor-resume-2026.html',
  '/assets/js/main.js',
  '/assets/js/home.js',
  '/assets/js/music.js',
  '/assets/js/projects.js',
  '/assets/js/blog.js',
  '/assets/js/books.js',
  '/assets/js/celeste.js',
  '/assets/js/theme-bootstrap.js',
  '/assets/js/theme.js',
  '/assets/js/site-shell.js',
  '/assets/js/nav.js',
  '/assets/js/state.js',
  '/assets/js/utils.js',
  '/assets/js/music-embeds.js',
  '/assets/js/life-development-dna.js',
  '/assets/js/focus-management.js',
  '/assets/js/image-handling.js',
  '/assets/js/lazy-loading.js',
  '/assets/js/gallery-renderer.js',
  '/assets/js/lightbox.js',
  '/assets/js/album-viewer.js',
  '/assets/js/albums.js',
  '/assets/js/data-processing.js',
  '/assets/js/ui.js',
  '/assets/images/signature.svg',
  '/assets/images/profile-small.jpg',
  '/assets/images/profile.jpg',
  '/assets/images/soon.svg',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Failed to cache some static assets:', err);
        // Continue even if some assets fail to cache
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches that don't match current version
          if (
            cacheName !== CACHE_NAME &&
            cacheName !== STATIC_CACHE &&
            cacheName !== IMAGE_CACHE &&
            cacheName !== DATA_CACHE
          ) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control of all pages immediately
});

// Helper: Calculate cache size
async function getCacheSize(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  let size = 0;
  
  for (const key of keys) {
    const response = await cache.match(key);
    if (response) {
      const blob = await response.blob();
      size += blob.size;
    }
  }
  
  return size;
}

// Helper: Clean up old images from cache if it's too large
async function cleanImageCache() {
  const cache = await caches.open(IMAGE_CACHE);
  const keys = await cache.keys();
  
  // Sort by URL (newest first, assuming newer URLs come later)
  const sortedKeys = Array.from(keys).sort().reverse();
  
  let currentSize = await getCacheSize(IMAGE_CACHE);
  
  // Remove oldest entries until under limit
  while (currentSize > MAX_IMAGE_CACHE_SIZE && sortedKeys.length > 0) {
    const key = sortedKeys.pop();
    await cache.delete(key);
    const response = await cache.match(key);
    if (response) {
      const blob = await response.blob();
      currentSize -= blob.size;
    }
  }
}

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests (including Google Photos - they don't support CORS properly)
  if (url.origin !== location.origin) {
    return;
  }
  
  // Strategy 1: Network-first for JavaScript (always get latest code)
  if (url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.open(STATIC_CACHE).then((cache) => {
            return cache.match(request);
          });
        })
    );
    return;
  }
  
  // Strategy 2: Network-first for CSS (so changes appear without hard refresh)
  if (url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.open(STATIC_CACHE).then((cache) => cache.match(request)))
    );
    return;
  }
  
  // Strategy 2b: Cache-first for fonts and other static assets
  if (
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.otf') ||
    url.pathname.endsWith('.svg') ||
    (url.pathname.endsWith('.png') && url.pathname.includes('assets/'))
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(request).then((response) => {
            if (response.status === 200) cache.put(request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }
  
  // Strategy 3: Network-first for JSON data (always try to get fresh data)
  if (url.pathname.endsWith('.json') || url.pathname.startsWith('/data/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DATA_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return a basic error response if nothing in cache
            return new Response(
              JSON.stringify({ error: 'Offline and not cached' }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' },
              }
            );
          });
        })
    );
    return;
  }
  
  // Strategy 3: Cache-first for images (thumbnails and full images)
  // Skip Google Photos images - they don't support CORS and cause OpaqueResponseBlocking
  if (
    (url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webp')) &&
    !url.hostname.includes('googleusercontent.com')
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached version immediately
            return cachedResponse;
          }
          
          // Fetch from network
          const placeholderSvg = new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#f0f0f0"/><text x="50%" y="50%" text-anchor="middle" fill="#999">Image unavailable</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
          return fetch(request)
            .then((response) => {
              if (response.ok && response.status === 200) {
                cache.put(request, response.clone());
                cleanImageCache().catch((err) => {
                  console.warn('[Service Worker] Cache cleanup error:', err);
                });
                return response;
              }
              // Local gallery files under /content/: return real 404/502 so <img> onerror can fall back
              // (e.g. ambient full-size missing, thumbnail present). A fake 200+SVG would fire onload and block that.
              if (url.pathname.includes("/content/")) {
                return response;
              }
              return placeholderSvg.clone();
            })
            .catch(() => {
              if (url.pathname.includes("/content/")) {
                return new Response(null, { status: 503, statusText: "Network error" });
              }
              return placeholderSvg.clone();
            });
        });
      })
    );
    return;
  }
  
  // Strategy 4: Network-first for HTML pages (so changes appear without hard refresh)
  if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.open(STATIC_CACHE).then((cache) => cache.match(request)))
    );
    return;
  }
  
  // Default: Network-first for everything else
  event.respondWith(
    fetch(request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
  
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    Promise.all([
      getCacheSize(STATIC_CACHE),
      getCacheSize(IMAGE_CACHE),
      getCacheSize(DATA_CACHE),
    ]).then(([staticSize, imageSize, dataSize]) => {
      event.ports[0].postMessage({
        static: staticSize,
        images: imageSize,
        data: dataSize,
        total: staticSize + imageSize + dataSize,
      });
    });
  }
});
