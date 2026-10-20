import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadBrowserSearch, resetBrowserSearchForTesting } from './load-browser-search'
import type { SearchDocument } from './search-document'

const documents: SearchDocument[] = [{
  id: 'note', type: 'writing', category: 'note', title: 'Tools',
  summary: '', href: '/posts/tools', topics: [], content: '', external: false,
}]

afterEach(() => {
  resetBrowserSearchForTesting()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('browser search loading', () => {
  it('shares one in-flight load across concurrent consumers and caches success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(documents))))
    const firstConsumer = loadBrowserSearch()
    expect(loadBrowserSearch()).toBe(firstConsumer)
    const runtime = await firstConsumer
    await expect(loadBrowserSearch()).resolves.toBe(runtime)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('clears a failed shared load so a later consumer can retry', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(documents))))
    const firstConsumer = loadBrowserSearch()
    expect(loadBrowserSearch()).toBe(firstConsumer)
    await expect(firstConsumer).rejects.toThrow('503')
    await expect(loadBrowserSearch()).resolves.toMatchObject({ engine: { documents } })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
