import { describe, expect, it, vi } from 'vitest'
import {
  getMarkdownAssetPath,
  handleAgentMarkdownRequest,
  prefersMarkdown,
  type AssetFetcher,
} from '.'

interface MockAssets extends AssetFetcher {
  requests: Request[]
}

const createAssets = (responses: Record<string, Response>): MockAssets => {
  const requests: Request[] = []
  return {
    requests,
    fetch: vi.fn((request: Request) => {
      requests.push(request)
      return Promise.resolve(
        responses[new URL(request.url).pathname]?.clone() ?? new Response('Not found', {
          headers: { 'Content-Type': 'text/html' },
          status: 404,
        }),
      )
    }),
  }
}

describe('agent Markdown request matching', () => {
  it('recognizes explicit Markdown preferences without overriding preferred HTML', () => {
    expect(prefersMarkdown('text/markdown')).toBe(true)
    expect(prefersMarkdown('text/html;q=0.8, text/markdown;q=0.9')).toBe(true)
    expect(prefersMarkdown('text/html, text/markdown;q=0.5')).toBe(false)
    expect(prefersMarkdown('text/markdown;q=0')).toBe(false)
    expect(prefersMarkdown('*/*')).toBe(false)
    expect(prefersMarkdown(null)).toBe(false)
  })

  it('maps only post detail routes to Markdown assets', () => {
    expect(getMarkdownAssetPath('/posts/a-note')).toBe('/posts/a-note.md')
    expect(getMarkdownAssetPath('/posts/a-note/')).toBe('/posts/a-note.md')
    expect(getMarkdownAssetPath('/posts/a-note.md')).toBeUndefined()
    expect(getMarkdownAssetPath('/posts/')).toBeUndefined()
    expect(getMarkdownAssetPath('/about')).toBeUndefined()
  })
})

describe('agent Markdown negotiation', () => {
  it('serves the prebuilt Markdown artifact for a negotiated request', async () => {
    const assets = createAssets({
      '/posts/a-note.md': new Response('# A note', { headers: { ETag: 'content-tag' } }),
    })
    const request = new Request('https://amaral.codes/posts/a-note?ref=agent', {
      headers: { Accept: 'text/markdown' },
    })

    const response = await handleAgentMarkdownRequest(request, { ASSETS: assets })

    expect(await response.text()).toBe('# A note')
    expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    expect(response.headers.get('Content-Location')).toBe('/posts/a-note.md')
    expect(response.headers.get('Vary')).toBe('Accept')
    expect(response.headers.get('ETag')).toBe('content-tag')
    expect(response.headers.get('Link')).toBe(
      '</posts/a-note>; rel="canonical"; type="text/html", '
      + '</llms.txt>; rel="describedby"',
    )
    expect(new URL(assets.requests[0]?.url ?? '').search).toBe('')
  })

  it('keeps HTML for browser requests and missing Markdown artifacts', async () => {
    const assets = createAssets({
      '/posts/a-note': new Response('<h1>A note</h1>', { headers: { Vary: 'Cookie' } }),
    })

    const browserResponse = await handleAgentMarkdownRequest(
      new Request('https://amaral.codes/posts/a-note', { headers: { Accept: 'text/html' } }),
      { ASSETS: assets },
    )
    const missingResponse = await handleAgentMarkdownRequest(
      new Request('https://amaral.codes/posts/a-note', { headers: { Accept: 'text/markdown' } }),
      { ASSETS: assets },
    )

    expect(await browserResponse.text()).toContain('<h1>A note</h1>')
    expect(browserResponse.headers.get('Vary')).toBe('Cookie, Accept')
    expect(browserResponse.headers.get('Link')).toBe(
      '</posts/a-note.md>; rel="alternate"; type="text/markdown", '
      + '</llms.txt>; rel="describedby"',
    )
    expect(await missingResponse.text()).toContain('<h1>A note</h1>')
  })

  it('normalizes direct Markdown responses and passes unrelated requests through', async () => {
    const assets = createAssets({
      '/about': new Response('About'),
      '/posts/a-note.md': new Response('# A note', { headers: { Vary: '*' } }),
    })

    const markdownResponse = await handleAgentMarkdownRequest(
      new Request('https://amaral.codes/posts/a-note.md'),
      { ASSETS: assets },
    )
    const unrelatedResponse = await handleAgentMarkdownRequest(
      new Request('https://amaral.codes/about'),
      { ASSETS: assets },
    )

    expect(markdownResponse.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    expect(markdownResponse.headers.get('Vary')).toBe('*')
    expect(markdownResponse.headers.get('Link')).toContain('rel="canonical"')
    expect(await unrelatedResponse.text()).toBe('About')
  })

  it('does not negotiate unsupported methods', async () => {
    const assets = createAssets({ '/posts/a-note': new Response('Method response') })
    const response = await handleAgentMarkdownRequest(
      new Request('https://amaral.codes/posts/a-note', { method: 'POST' }),
      { ASSETS: assets },
    )

    expect(await response.text()).toBe('Method response')
    expect(assets.requests).toHaveLength(1)
  })
})

describe('agent discovery response headers', () => {
  it('preserves existing Link headers and does not decorate failed HTML responses', async () => {
    const assets = createAssets({
      '/posts/a-note': new Response('<h1>A note</h1>', {
        headers: { Link: '</styles.css>; rel="preload"' },
      }),
    })
    const response = await handleAgentMarkdownRequest(
      new Request('https://amaral.codes/posts/a-note', { headers: { Accept: 'text/html' } }),
      { ASSETS: assets },
    )
    const missing = await handleAgentMarkdownRequest(
      new Request('https://amaral.codes/posts/missing', { headers: { Accept: 'text/html' } }),
      { ASSETS: assets },
    )

    expect(response.headers.get('Link')).toContain('</styles.css>; rel="preload"')
    expect(response.headers.get('Link')).toContain('</posts/a-note.md>; rel="alternate"')
    expect(missing.status).toBe(404)
    expect(missing.headers.get('Link')).toBeNull()
    expect(missing.headers.get('Vary')).toBeNull()
  })
})
