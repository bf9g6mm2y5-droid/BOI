/**
 * Bank of Ireland Mobile PWA Service Worker
 * Handles caching, offline functionality, and prevents blank screens
 * 
 * VERSION: 4.7.0 - Status bar fix, device-lock removal, offline transaction
 * sync, local live chat engine, Share/copy restored, polling cleanup
 * BUILD: {{BUILD_TIMESTAMP}}
 */

const SW_VERSION = '4.7.0';
const BUILD_TIMESTAMP = Date.now();
const CACHE_NAME = `boi-mobile-v${SW_VERSION}-${BUILD_TIMESTAMP}`;
const FALLBACK_CACHE = `boi-fallback-v${SW_VERSION}`;

// Critical assets that must be cached for PWA to work
const CRITICAL_ASSETS = [
  '/',
  '/client/index.html',
  '/client/src/main.tsx',
  '/client/src/App.tsx',
  '/client/src/index.css',
  '/manifest.json',
  '/boi_app_icon.png',
  '/boi_logo.svg'
];

// Assets to cache for better performance
const CACHE_ASSETS = [
  '/icon-footer-accounts.svg',
  '/icon-footer-accounts-highlight.svg',
  '/icon-footer-payments.svg',
  '/icon-footer-payments-highlight.svg',
  '/icon-footer-services.svg',
  '/icon-footer-services-highlight.svg',
  '/icon-footer-apply.svg',
  '/icon-footer-apply-highlight.svg',
  '/icon-footer-more.svg',
  '/icon-footer-more-highlight.svg',
  '/Icons_Fingerprint.svg',
  '/icon_HID.svg'
];

// Network-first patterns for API calls
const NETWORK_FIRST_PATTERNS = [
  /\/api\//,
  /\/auth\//,
  /\/login/,
  /\/dashboard/
];

// Cache-first patterns for static assets
const CACHE_FIRST_PATTERNS = [
  /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
  /\.(?:css|js|woff|woff2|ttf|eot)$/
];

// Inline fallback HTML generator (used if offline.html file fetch fails)
function createInlineOfflineHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>Bank of Ireland - Offline</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: linear-gradient(135deg, #126987 0%, #0e5a75 100%); color: white; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { text-align: center; max-width: 400px; }
    .logo { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
    .message { margin-bottom: 30px; line-height: 1.6; }
    .btn { background: white; color: #126987; border: none; padding: 15px 30px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; margin: 10px; display: block; width: 100%; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Bank of Ireland</div>
    <div class="message">You're currently offline. Please check your internet connection.</div>
    <button class="btn" onclick="location.reload()">Retry Connection</button>
    <button class="btn" onclick="caches.keys().then(k=>Promise.all(k.map(n=>caches.delete(n)))).then(()=>location.reload())">Clear Cache & Reload</button>
  </div>
</body>
</html>`;
}

self.addEventListener('install', (event) => {
  console.log(`📱 PWA Service Worker v${SW_VERSION} installing (build: ${BUILD_TIMESTAMP})...`);
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(async (cache) => {
        console.log('💾 Caching critical assets with cache-busting');
        const requests = CRITICAL_ASSETS.concat(CACHE_ASSETS).map(url => {
          const cacheBustUrl = url.includes('?') 
            ? `${url}&v=${SW_VERSION}&t=${BUILD_TIMESTAMP}`
            : `${url}?v=${SW_VERSION}&t=${BUILD_TIMESTAMP}`;
          return new Request(cacheBustUrl, { cache: 'no-cache' });
        });
        
        try {
          await Promise.all(requests.map(async (req) => {
            try {
              const response = await fetch(req, { cache: 'no-cache' });
              if (response.ok) {
                const originalUrl = req.url.split('?')[0];
                await cache.put(originalUrl, response);
              }
            } catch (err) {
              console.warn('Failed to cache:', req.url, err);
            }
          }));
        } catch (err) {
          console.warn('Caching error:', err);
        }
        
        return cache;
      }),
      
      caches.open(FALLBACK_CACHE).then(async (cache) => {
        console.log('💾 Caching offline.html fallback page');
        try {
          const response = await fetch(`/offline.html?v=${SW_VERSION}&t=${BUILD_TIMESTAMP}`, { 
            cache: 'no-cache' 
          });
          if (response.ok) {
            await cache.put('/offline.html', response);
            console.log('✅ offline.html cached successfully');
          } else {
            console.warn('⚠️ Could not fetch offline.html, creating inline fallback');
            await cache.put('/offline.html', new Response(createInlineOfflineHTML(), {
              headers: { 'Content-Type': 'text/html' }
            }));
          }
        } catch (err) {
          console.warn('⚠️ Error caching offline.html:', err);
          await cache.put('/offline.html', new Response(createInlineOfflineHTML(), {
            headers: { 'Content-Type': 'text/html' }
          }));
        }
        return cache;
      })
    ]).then(() => {
      console.log('✅ PWA Service Worker installed successfully');
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log(`🚀 PWA Service Worker v${SW_VERSION} activating (build: ${BUILD_TIMESTAMP})...`);
  
  event.waitUntil(
    Promise.all([
      self.clients.claim()
    ]).then(() => {
      console.log(`✅ PWA Service Worker v${SW_VERSION} activated`);
      
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ 
            type: 'SW_ACTIVATED',
            version: SW_VERSION,
            buildTimestamp: BUILD_TIMESTAMP,
            message: `App updated to v${SW_VERSION}`
          });
        });
      });
      
      // Delay old cache cleanup by 30 seconds so any running app can finish loading
      // This prevents crashes when users have the app open during an update
      setTimeout(() => {
        caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              if (cacheName === FALLBACK_CACHE) {
                return Promise.resolve();
              }
              if (cacheName.startsWith('boi-mobile-') && 
                  (!cacheName.includes(SW_VERSION) || !cacheName.includes(String(BUILD_TIMESTAMP)))) {
                console.log('🗑️ Cleaning old cache:', cacheName);
                return caches.delete(cacheName);
              }
              if (cacheName.startsWith('boi-fallback-') && cacheName !== FALLBACK_CACHE) {
                console.log('🗑️ Cleaning old fallback cache:', cacheName);
                return caches.delete(cacheName);
              }
              return Promise.resolve();
            })
          );
        });
      }, 30000);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests unless it's our API
  if (url.origin !== location.origin) {
    return;
  }
  
  event.respondWith(handleFetch(request));
});

async function handleFetch(request) {
  const url = new URL(request.url);
  
  try {
    // Network-first strategy for API calls and dynamic content
    if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname))) {
      return await networkFirstStrategy(request);
    }
    
    // Cache-first strategy for static assets
    if (CACHE_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname))) {
      return await cacheFirstStrategy(request);
    }
    
    // Stale-while-revalidate for HTML pages
    return await staleWhileRevalidateStrategy(request);
    
  } catch (error) {
    console.error('Fetch handler error:', error);
    return await getFallbackResponse(request);
  }
}

function isHashedAsset(pathname) {
  return /\.(js|css)$/.test(pathname) && /[.-][a-f0-9]{8,}\./.test(pathname);
}

function handleStaleBundleResponse(request) {
  const url = new URL(request.url);
  console.warn('⚠️ Stale hashed asset detected:', url.pathname);
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'SW_STALE_BUNDLE', url: url.pathname });
    });
  });
  return new Response('', { status: 204, statusText: 'Refreshing' });
}

async function networkFirstStrategy(request) {
  const url = new URL(request.url);
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    } else if (!networkResponse.ok && isHashedAsset(url.pathname)) {
      return handleStaleBundleResponse(request);
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const url = new URL(request.url);
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    if (isHashedAsset(url.pathname)) {
      return handleStaleBundleResponse(request);
    }
    
    return networkResponse;
  } catch (error) {
    if (isHashedAsset(url.pathname)) {
      return handleStaleBundleResponse(request);
    }
    throw error;
  }
}

async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  const url = new URL(request.url);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    return null;
  });
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const networkResponse = await fetchPromise;
  if (networkResponse) {
    if (!networkResponse.ok && isHashedAsset(url.pathname)) {
      return handleStaleBundleResponse(request);
    }
    return networkResponse;
  }
  
  if (isHashedAsset(url.pathname)) {
    return handleStaleBundleResponse(request);
  }
  
  throw new Error('No cache and network failed');
}

async function getFallbackResponse(request) {
  const url = new URL(request.url);
  
  // For HTML requests, return offline page
  if (request.headers.get('accept')?.includes('text/html')) {
    const offlineResponse = await caches.match('/offline.html');
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // Ultimate fallback for main page
    if (url.pathname === '/') {
      const indexResponse = await caches.match('/client/index.html');
      if (indexResponse) {
        return indexResponse;
      }
    }
  }
  
  if (isHashedAsset(url.pathname)) {
    return handleStaleBundleResponse(request);
  }
  
  // For other requests, return a basic error response
  return new Response('Offline - Content unavailable', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain' }
  });
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('📱 Skipping waiting period');
    self.skipWaiting();
  }
});

// Handle errors
self.addEventListener('error', (event) => {
  console.error('PWA Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('PWA Service Worker unhandled rejection:', event.reason);
});

console.log('📱 Bank of Ireland PWA Service Worker loaded');