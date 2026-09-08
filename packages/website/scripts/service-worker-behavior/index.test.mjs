import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import { test } from 'vitest'
import { injectManifest } from '../service-worker-build/index.mjs'

const ORIGIN = 'https://amaral.codes'
const TEMPLATE_PATH = new URL('../../src/pwa/service-worker.js', import.meta.url)

const toUrl = (request) => new URL(
  typeof request === 'string' ? request : request.url,
  ORIGIN,
)

class MemoryCache {
  constructor() {
    this.entries = new Map()
  }

  async addAll(urls) {
    await Promise.all(urls.map(url => this.put(url, new Response(`precached:${url}`))))
  }

  async delete(request) {
    return this.entries.delete(toUrl(request).href)
  }

  async keys() {
    return [...this.entries.keys()].map(url => ({ url }))
  }

  async match(request, options = {}) {
    const requestedUrl = toUrl(request)
    for (const [url, response] of this.entries) {
      const cachedUrl = new URL(url)
      const matches = options.ignoreSearch
        ? cachedUrl.origin === requestedUrl.origin && cachedUrl.pathname === requestedUrl.pathname
        : cachedUrl.href === requestedUrl.href
      if (matches) return response.clone()
    }
    return undefined
  }

  async put(request, response) {
    this.entries.set(toUrl(request).href, response.clone())
  }
}

class MemoryCacheStorage {
  constructor() {
    this.caches = new Map()
    this.deleted = []
    this.matchCalls = []
  }

  async delete(name) {
    this.deleted.push(name)
    return this.caches.delete(name)
  }

  async keys() {
    return [...this.caches.keys()]
  }

  async match(request, options) {
    this.matchCalls.push({ options, request })
    for (const cache of this.caches.values()) {
      const response = await cache.match(request, options)
      if (response) return response
    }
    return undefined
  }

  async open(name) {
    if (!this.caches.has(name)) this.caches.set(name, new MemoryCache())
    return this.caches.get(name)
  }
}

const createWorker = async ({ fetch = globalThis.fetch } = {}) => {
  const listeners = new Map()
  const caches = new MemoryCacheStorage()
  let claimed = false
  let skippedWaiting = false
  const self = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    clients: {
      claim: async () => {
        claimed = true
      },
    },
    location: new URL(`${ORIGIN}/service-worker.js`),
    skipWaiting: async () => {
      skippedWaiting = true
    },
  }
  const template = await fs.readFile(TEMPLATE_PATH, 'utf8')
  const source = injectManifest(template, ['/', '/offline/'], 'test-build')

  vm.runInNewContext(source, {
    Promise,
    Response,
    Set,
    URL,
    caches,
    fetch,
    self,
  })

  return {
    caches,
    dispatch: (type, event) => listeners.get(type)(event),
    wasClaimed: () => claimed,
    wasWaitingSkipped: () => skippedWaiting,
  }
}

const dispatchExtendableEvent = async (worker, type) => {
  let completion
  worker.dispatch(type, {
    waitUntil: promise => {
      completion = promise
    },
  })
  await completion
}

const dispatchNavigation = async (worker, path) => {
  let response
  worker.dispatch('fetch', {
    request: {
      method: 'GET',
      mode: 'navigate',
      url: new URL(path, ORIGIN).href,
    },
    respondWith: promise => {
      response = promise
    },
  })
  return response
}

const dispatchAsset = async (worker, path) => {
  let completion
  let response
  worker.dispatch('fetch', {
    request: {
      destination: 'script',
      method: 'GET',
      mode: 'cors',
      url: new URL(path, ORIGIN).href,
    },
    respondWith: promise => {
      response = promise
    },
    waitUntil: promise => {
      completion = promise
    },
  })
  const result = await response
  await completion
  return result
}

test('install precaches the shell before activating the worker', async () => {
  const worker = await createWorker()

  await dispatchExtendableEvent(worker, 'install')

  const shell = await worker.caches.open('amaral-shell-test-build')
  assert.equal(await (await shell.match('/')).text(), 'precached:/')
  assert.equal(await (await shell.match('/offline/')).text(), 'precached:/offline/')
  assert.equal(worker.wasWaitingSkipped(), true)
})

test('activation removes only outdated site caches and claims clients', async () => {
  const worker = await createWorker()
  await worker.caches.open('amaral-shell-test-build')
  await worker.caches.open('amaral-pages-previous-build')
  await worker.caches.open('amaral-runtime-previous-build')
  await worker.caches.open('another-application')

  await dispatchExtendableEvent(worker, 'activate')

  assert.deepEqual(worker.caches.deleted.sort(), [
    'amaral-pages-previous-build',
    'amaral-runtime-previous-build',
  ])
  assert.deepEqual((await worker.caches.keys()).sort(), [
    'amaral-shell-test-build',
    'another-application',
  ])
  assert.equal(worker.wasClaimed(), true)
})

test('offline navigation serves a cached page or the offline shell', async () => {
  const worker = await createWorker({ fetch: async () => { throw new Error('offline') } })
  const pages = await worker.caches.open('amaral-pages-test-build')
  const shell = await worker.caches.open('amaral-shell-test-build')
  await pages.put('/posts/cached/', new Response('cached article'))
  await shell.put('/offline/', new Response('offline shell'))

  const cached = await dispatchNavigation(worker, '/posts/cached/?tracking=ignored')
  const fallback = await dispatchNavigation(worker, '/posts/not-cached/')

  assert.equal(await cached.text(), 'cached article')
  assert.equal(await fallback.text(), 'offline shell')
})

test('cached scripts ignore response variants when the network is unavailable', async () => {
  const worker = await createWorker({ fetch: async () => { throw new Error('offline') } })
  const shell = await worker.caches.open('amaral-shell-test-build')
  await shell.put('/_astro/posts.js', new Response('cached posts module'))

  const response = await dispatchAsset(worker, '/_astro/posts.js')

  assert.equal(await response.text(), 'cached posts module')
  assert.equal(worker.caches.matchCalls.at(-1).options.ignoreVary, true)
})
