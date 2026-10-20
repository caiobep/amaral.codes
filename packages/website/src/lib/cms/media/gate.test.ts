import type { APIContext } from 'astro'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { guardMediaRequest } from './gate'

const access = vi.hoisted(() => ({
  editorCanReadMedia: vi.fn(),
  publishedPostReferences: vi.fn(),
  previewPostReferences: vi.fn(),
  requestPreviewToken: vi.fn(),
}))
const deletion = vi.hoisted(() => ({ mediaDeletionResponse: vi.fn() }))
vi.mock('./access', () => access)
vi.mock('./deletion', () => deletion)

function context(path: string): APIContext {
  return {
    url: new URL(path, 'http://localhost'),
    cache: { set: vi.fn() },
  } as unknown as APIContext
}

beforeEach(() => {
  vi.resetAllMocks()
  deletion.mediaDeletionResponse.mockResolvedValue(null)
  access.editorCanReadMedia.mockResolvedValue(false)
  access.publishedPostReferences.mockResolvedValue(false)
  access.previewPostReferences.mockResolvedValue(false)
  access.requestPreviewToken.mockReturnValue('signed')
})

it('stops a referenced media deletion before the native handler', async () => {
  const response = new Response('Media is in use', { status: 409 })
  deletion.mediaDeletionResponse.mockResolvedValue(response)
  const next = vi.fn(() => Promise.resolve(new Response('Deleted')))
  expect(
    await guardMediaRequest(context('/_emdash/api/media/media-id'), next),
  ).toBe(response)
  expect(next).not.toHaveBeenCalled()
})

describe('media request gate', () => {
  it('rejects malformed transformation sources without a server error', async () => {
    const next = vi.fn(() => Promise.resolve(new Response('File')))
    expect(
      (await guardMediaRequest(context('/_image?href=http%3A%2F%2F%5B'), next))
        .status,
    ).toBe(404)
    expect(next).not.toHaveBeenCalled()
  })
  it('leaves unrelated requests alone', async () => {
    const next = vi.fn(() => Promise.resolve(new Response('Page')))
    expect((await guardMediaRequest(context('/'), next)).status).toBe(200)
    expect(access.editorCanReadMedia).not.toHaveBeenCalled()
  })

  it('rejects invalid storage keys before authorization or storage', async () => {
    const next = vi.fn(() => Promise.resolve(new Response('File')))
    expect(
      (
        await guardMediaRequest(
          context('/_emdash/api/media/file/backups%2Fprivate'),
          next,
        )
      ).status,
    ).toBe(404)
    expect(next).not.toHaveBeenCalled()
    expect(access.editorCanReadMedia).not.toHaveBeenCalled()
  })

  it('allows an authenticated editor and disables media caching', async () => {
    access.editorCanReadMedia.mockResolvedValue(true)
    const request = context('/_emdash/api/media/file/pixel.png')
    const result = await guardMediaRequest(request, () =>
      Promise.resolve(new Response('Image')),
    )
    expect(result.status).toBe(200)
    expect(result.headers.get('Cache-Control')).toBe('private, no-store')
    expect(result.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store')
    expect(access.publishedPostReferences).not.toHaveBeenCalled()
  })

  it('allows only current published references to anonymous visitors', async () => {
    access.publishedPostReferences.mockResolvedValue(true)
    expect(
      (
        await guardMediaRequest(
          context('/_image/?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2Fpixel.png'),
          () => Promise.resolve(new Response('Image')),
        )
      ).status,
    ).toBe(200)
    expect(access.publishedPostReferences).toHaveBeenCalledWith('pixel.png')
    expect(access.previewPostReferences).not.toHaveBeenCalled()
  })

  it('delegates signed preview scope to the matching entry-reference check', async () => {
    access.previewPostReferences.mockResolvedValue(true)
    expect(
      (
        await guardMediaRequest(
          context('/_emdash/api/media/file/pixel.png?_preview=signed'),
          () => Promise.resolve(new Response('Image')),
        )
      ).status,
    ).toBe(200)
    expect(access.previewPostReferences).toHaveBeenCalledWith(
      'signed',
      'pixel.png',
    )
  })

  it('denies drafts and orphans without downloading their bytes', async () => {
    const next = vi.fn(() => Promise.resolve(new Response('Image')))
    const result = await guardMediaRequest(
      context('/_image?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2Forphan.png'),
      next,
    )
    expect(result.status).toBe(404)
    expect(result.headers.get('Cache-Control')).toContain('no-store')
    expect(next).not.toHaveBeenCalled()
  })
})
