const BUILD_ID = 'BUILD_ID_PLACEHOLDER'
const PRECACHE_URLS = [/* PRECACHE_URLS_PLACEHOLDER */]

const CACHE_PREFIX = 'amaral-'
const SHELL_CACHE = `${CACHE_PREFIX}shell-${BUILD_ID}`
const PAGE_CACHE = `${CACHE_PREFIX}pages-${BUILD_ID}`
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${BUILD_ID}`
const PAGE_CACHE_LIMIT = 40
const RUNTIME_CACHE_LIMIT = 100

const isCacheableResponse = (response) => response.ok && ['basic', 'default'].includes(response.type)

const trimCache = async (cache, limit) => {
  const requests = await cache.keys()
  const excess = requests.length - limit
  if (excess <= 0) return
  await Promise.all(requests.slice(0, excess).map((request) => cache.delete(request)))
}

const storeResponse = async (cacheName, request, response, limit) => {
  if (!isCacheableResponse(response)) return response
  const cache = await caches.open(cacheName)
  await cache.put(request, response.clone())
  await trimCache(cache, limit)
  return response
}

const networkFirstNavigation = async (request) => {
  try {
    const response = await fetch(request)
    return storeResponse(PAGE_CACHE, request, response, PAGE_CACHE_LIMIT)
  } catch {
    return (await caches.match(request, { ignoreSearch: true })) ?? caches.match('/offline/')
  }
}

const fetchAndStoreAsset = async (request) => {
  const response = await fetch(request)
  return storeResponse(RUNTIME_CACHE, request, response, RUNTIME_CACHE_LIMIT)
}

const staleWhileRevalidate = async (event) => {
  // Precache fetches and ES module requests can carry different Origin variants.
  const cached = await caches.match(event.request, {
    ignoreVary: event.request.destination === 'script',
  })
  const fresh = fetchAndStoreAsset(event.request).catch(() => undefined)
  if (!cached) return (await fresh) ?? Response.error()
  event.waitUntil(fresh)
  return cached
}

const getCachedRuntimeData = async (request) => {
  const runtimeCache = await caches.open(RUNTIME_CACHE)
  const runtimeResponse = await runtimeCache.match(request)
  if (runtimeResponse) return runtimeResponse

  const shellCache = await caches.open(SHELL_CACHE)
  return shellCache.match(request)
}

const networkFirstRuntimeData = async (request) => {
  try {
    const response = await fetch(request, { cache: 'no-store' })
    return storeResponse(RUNTIME_CACHE, request, response, RUNTIME_CACHE_LIMIT)
  } catch {
    return (await getCachedRuntimeData(request)) ?? Response.error()
  }
}

const isRuntimeAsset = (request) => {
  const destinations = ['font', 'image', 'script', 'style']
  return destinations.includes(request.destination)
}

const isRuntimeData = (url) => url.pathname === '/search-index.json'

const removeOutdatedCaches = async () => {
  const cacheNames = await caches.keys()
  const currentCaches = new Set([SHELL_CACHE, PAGE_CACHE, RUNTIME_CACHE])
  const outdated = cacheNames.filter(name => name.startsWith(CACHE_PREFIX) && !currentCaches.has(name))
  await Promise.all(outdated.map(name => caches.delete(name)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(removeOutdatedCaches().then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (isRuntimeData(url)) {
    event.respondWith(networkFirstRuntimeData(request))
    return
  }

  if (isRuntimeAsset(request)) {
    event.respondWith(staleWhileRevalidate(event))
  }
})
