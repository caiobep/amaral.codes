import assert from 'node:assert/strict'
import type { PayloadRequest } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { User } from '../../payload-types'
import { Media } from './index'

const author: User = {
  id: 1,
  collection: 'users',
  email: 'author@example.com',
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
}

function request(user: PayloadRequest['user'] = null): PayloadRequest {
  return { user } as PayloadRequest
}

function uploadOptions() {
  const upload = Media.upload
  assert(upload && typeof upload === 'object')
  return upload
}

describe('private media', () => {
  it('stores supported authoring assets locally and requires descriptive text', () => {
    expect(Media.slug).toBe('media')
    expect(uploadOptions()).toMatchObject({
      staticDir: '.local/uploads',
      mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf', 'audio/mpeg'],
    })
    expect(Media.fields).toEqual([
      { name: 'alt', label: 'Description / alt text', type: 'text', required: true },
    ])
  })

  it.each(['create', 'read', 'update', 'delete'] as const)(
    'requires authentication for media %s',
    async (operation) => {
      const access = Media.access?.[operation]
      assert(access)

      expect(await access({ req: request() })).toBe(false)
      expect(await access({ req: request(author) })).toBe(true)
    },
  )
})

describe('media storage isolation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it.each([
    { mode: undefined, directory: '.local/uploads' },
    { mode: '0', directory: '.local/uploads' },
    { mode: 'true', directory: '.local/uploads' },
    { mode: '1', directory: '.local/test/uploads' },
  ])('uses $directory when CMS_TRIAL_TEST is $mode', async ({ mode, directory }) => {
    vi.stubEnv('CMS_TRIAL_TEST', mode)
    vi.resetModules()

    const { Media: isolatedMedia } = await import('./index')

    expect(isolatedMedia.upload).toMatchObject({ staticDir: directory })
  })
})

describe('media response headers', () => {
  it('marks new file responses private, non-cacheable, and cookie-dependent', () => {
    const modifyHeaders = uploadOptions().modifyResponseHeaders
    assert(modifyHeaders)
    const headers = new Headers()

    const result = modifyHeaders({ headers })

    expect(result).toBe(headers)
    expect(headers.get('Cache-Control')).toBe('private, no-store')
    expect(headers.get('Vary')).toBe('Cookie')
  })

  it('overrides public caching while preserving content and download headers', () => {
    const modifyHeaders = uploadOptions().modifyResponseHeaders
    assert(modifyHeaders)
    const headers = new Headers({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="slides.pdf"',
    })

    const result = modifyHeaders({ headers })

    expect(result).toBe(headers)
    expect(headers.get('Cache-Control')).toBe('private, no-store')
    expect(headers.get('Vary')).toBe('Cookie')
    expect(headers.get('Content-Type')).toBe('application/pdf')
    expect(headers.get('Content-Disposition')).toBe('attachment; filename="slides.pdf"')
  })
})
