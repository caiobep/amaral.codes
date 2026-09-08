import { describe, expect, it, vi } from 'vitest'
import { fetchPreview, parsePreview, PREVIEW_HEADERS } from './index'

const document = {
  id: 'preview-note',
  data: { title: 'Preview note', date: '2026-09-07', category: 'note' },
  html: '<p>Saved privately.</p>',
}

describe('private CMS preview', () => {
  it('uses the existing content contract and article entry shape', () => {
    expect(parsePreview(document)).toEqual({
      id: 'preview-note', collection: 'entries',
      data: { ...document.data, topics: [] },
      rendered: { html: document.html, metadata: { imagePaths: [] } },
    })
  })

  it.each([null, 'text', {}, { ...document, id: 1 }, { ...document, html: null }])('rejects malformed response %j', (value) => {
    expect(() => parsePreview(value)).toThrow('Invalid CMS preview response.')
  })

  it('rejects invalid public metadata', () => {
    expect(() => parsePreview({ ...document, data: { title: '' } })).toThrow()
  })

  it('forwards authentication only to the fixed local CMS endpoint', async () => {
    const response = new Response('{}')
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)
    const request = new Request('http://127.0.0.1:4324/cms-preview/1', { headers: { Cookie: 'session=test', 'Sec-Fetch-Site': 'same-site' } })
    expect(await fetchPreview(request, '../admin?draft=false', fetcher)).toBe(response)
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:4010/api/entries/..%2Fadmin%3Fdraft%3Dfalse/preview?revision=draft', {
      headers: new Headers({ Cookie: 'session=test', 'Sec-Fetch-Site': 'same-site' }), cache: 'no-store',
    })
  })

  it('can request the published revision separately without inventing credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    await fetchPreview(new Request('http://127.0.0.1:4324/cms-preview/1?revision=published'), '1', fetcher)
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:4010/api/entries/1/preview?revision=published', {
      headers: new Headers(), cache: 'no-store',
    })
  })

  it('keeps previews out of caches and indexing', () => {
    expect(PREVIEW_HEADERS['Cache-Control']).toBe('private, no-store')
    expect(PREVIEW_HEADERS['X-Robots-Tag']).toContain('noindex')
    expect(PREVIEW_HEADERS.Vary).toBe('Cookie')
  })
})
