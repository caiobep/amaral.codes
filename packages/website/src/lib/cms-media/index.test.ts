import { describe, expect, it, vi } from 'vitest'
import { fetchPreviewMedia } from './index'

describe('private preview media', () => {
  it('streams authenticated ranges without exposing upstream cookies or caching', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('pdf', { status: 206, headers: {
      'Content-Type': 'application/pdf', 'Content-Range': 'bytes 0-2/20',
      'Cache-Control': 'public', 'Set-Cookie': 'unwanted=value',
    } }))
    const response = await fetchPreviewMedia(new Request('http://localhost/talks/cms-preview/slides.pdf', {
      headers: { Cookie: 'payload-token=test', Range: 'bytes=0-2', Origin: 'http://127.0.0.1:4010', 'Sec-Fetch-Site': 'same-site' },
    }), 'slides.pdf', fetcher)
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:4010/api/media/file/slides.pdf', expect.objectContaining({
      headers: new Headers({ Cookie: 'payload-token=test', Range: 'bytes=0-2', Origin: 'http://127.0.0.1:4010', 'Sec-Fetch-Site': 'same-site' }), redirect: 'error',
    }))
    expect(response.status).toBe(206)
    expect(await response.text()).toBe('pdf')
    expect(response.headers.get('content-range')).toBe('bytes 0-2/20')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.has('set-cookie')).toBe(false)
  })

  it.each(['', '.', '..', '../secret', 'folder\\secret'])('rejects invalid filenames: %s', async filename => {
    const fetcher = vi.fn()
    expect((await fetchPreviewMedia(new Request('http://localhost'), filename, fetcher)).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('preserves authorization failures and HEAD requests', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 403 }))
    const response = await fetchPreviewMedia(new Request('http://localhost', { method: 'HEAD' }), 'private file.pdf', fetcher)
    expect(response.status).toBe(403)
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:4010/api/media/file/private%20file.pdf', expect.objectContaining({ method: 'HEAD' }))
  })
})
