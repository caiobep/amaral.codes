import type { APIContext } from 'astro'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mediaDeletionResponse } from './deletion'

const mocks = vi.hoisted(() => ({
  media: { findById: vi.fn() },
  references: vi.fn(),
}))
vi.mock('emdash/runtime', () => ({ getDb: () => Promise.resolve({}) }))
vi.mock('emdash', () => ({
  MediaRepository: vi.fn(function () {
    return mocks.media
  }),
}))
vi.mock('./deletion-references', () => ({
  protectedPostReferences: mocks.references,
}))

const editor = { id: 'editor', role: 40 }
const author = { id: 'author', role: 30 }

function context(
  path: string,
  user: unknown = editor,
  method = 'DELETE',
  body?: string,
): APIContext {
  const url = new URL(path, 'http://localhost')
  return {
    url,
    request: new Request(url, {
      method,
      ...(body === undefined ? {} : { body }),
    }),
    locals: { user },
  } as unknown as APIContext
}

function toolCall(name = 'media_delete', id: string | number = 7): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: { id: 'media-id' } },
  })
}

function tokenContext(scopes: string[]): APIContext {
  const request = context('/_emdash/api/mcp', editor, 'POST', toolCall())
  request.locals.tokenScopes = scopes
  return request
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.media.findById.mockResolvedValue({
    id: 'media-id',
    authorId: 'author',
    storageKey: 'pixel.png',
  })
  mocks.references.mockResolvedValue(true)
})

describe('media deletion HTTP guard', () => {
  it.each([
    '/_emdash/api/media/media-id',
    '/_emdash/api/media/providers/local/media-id',
    '/_emdash/api/media/%6dedia-id',
    '/_emdash/api/media/providers/%6cocal/media-id',
  ])(
    'blocks referenced media with an actionable conflict on %s',
    async path => {
      const result = await mediaDeletionResponse(context(path))
      expect(result?.status).toBe(409)
      const body: unknown = await result?.json()
      expect(body).toMatchObject({
        success: false,
        error: {
          code: 'MEDIA_IN_USE',
        },
      })
      expect(JSON.stringify(body)).toContain('Remove or replace the reference')
      expect(mocks.media.findById).toHaveBeenCalledWith('media-id')
    },
  )

  it('permits unrelated media and leaves absent media to native handling', async () => {
    mocks.references.mockResolvedValue(false)
    expect(
      await mediaDeletionResponse(context('/_emdash/api/media/media-id')),
    ).toBeNull()
    mocks.media.findById.mockResolvedValue(null)
    mocks.references.mockClear()
    expect(
      await mediaDeletionResponse(context('/_emdash/api/media/missing')),
    ).toBeNull()
    expect(mocks.references).not.toHaveBeenCalled()
  })
})

describe('native media deletion authorization', () => {
  it('preserves native ownership checks for authors', async () => {
    expect(
      (
        await mediaDeletionResponse(
          context('/_emdash/api/media/media-id', author),
        )
      )?.status,
    ).toBe(409)
    mocks.media.findById.mockResolvedValue({
      id: 'media-id',
      authorId: 'other',
      storageKey: 'pixel.png',
    })
    mocks.references.mockClear()
    expect(
      await mediaDeletionResponse(
        context('/_emdash/api/media/media-id', author),
      ),
    ).toBeNull()
    expect(mocks.references).not.toHaveBeenCalled()
  })

  it.each([null, { id: 'contributor', role: 20 }])(
    'delegates unauthorized requests without querying references',
    async user => {
      expect(
        await mediaDeletionResponse(
          context('/_emdash/api/media/media-id', user),
        ),
      ).toBeNull()
      expect(mocks.media.findById).not.toHaveBeenCalled()
    },
  )

  it('keeps provider deletion restricted to delete-any permission', async () => {
    expect(
      await mediaDeletionResponse(
        context('/_emdash/api/media/providers/local/media-id', author),
      ),
    ).toBeNull()
    expect(mocks.media.findById).not.toHaveBeenCalled()
  })
})

describe('native media deletion delegation', () => {
  it.each([
    ['/posts/post', 'DELETE'],
    ['/_emdash/api/media/media-id', 'PUT'],
    ['/_emdash/api/media/file/pixel.png', 'GET'],
    ['/_emdash/api/media/providers/remote/media-id', 'DELETE'],
  ])(
    'delegates unrelated routes and operations: %s %s',
    async (path, method) => {
      expect(
        await mediaDeletionResponse(context(path, editor, method)),
      ).toBeNull()
      expect(mocks.media.findById).not.toHaveBeenCalled()
    },
  )

  it('does not convert an unavailable reference check into permission to delete', async () => {
    mocks.references.mockRejectedValueOnce(new Error('Database unavailable'))
    await expect(
      mediaDeletionResponse(context('/_emdash/api/media/media-id')),
    ).rejects.toThrow('Database unavailable')
  })
})

describe('media deletion MCP guard', () => {
  it.each(['/_emdash/api/mcp/', '/_emdash/api/%6dcp'])(
    'guards the native endpoint alias %s',
    async path => {
      const result = await mediaDeletionResponse(
        context(path, editor, 'POST', toolCall()),
      )
      expect(await result?.json()).toMatchObject({ result: { isError: true } })
    },
  )
  it.each([7, 'request-id', 0])(
    'returns a native tool error for request %s',
    async id => {
      const request = context(
        '/_emdash/api/mcp',
        editor,
        'POST',
        toolCall('media_delete', id),
      )
      const result = await mediaDeletionResponse(request)
      expect(result?.status).toBe(200)
      expect(await result?.json()).toMatchObject({
        jsonrpc: '2.0',
        id,
        result: { isError: true, _meta: { code: 'MEDIA_IN_USE' } },
      })
      expect(await request.request.json()).toMatchObject({ id })
    },
  )

  it('requires native media-write token scope before disclosing a conflict', async () => {
    expect(
      await mediaDeletionResponse(tokenContext(['content:read'])),
    ).toBeNull()
    expect(mocks.media.findById).not.toHaveBeenCalled()
    expect(
      (await mediaDeletionResponse(tokenContext(['media:write'])))?.status,
    ).toBe(200)
  })

  it.each(['media_list', 'content_delete'])(
    'leaves %s tools to native dispatch',
    async name => {
      expect(
        await mediaDeletionResponse(
          context('/_emdash/api/mcp', editor, 'POST', toolCall(name)),
        ),
      ).toBeNull()
      expect(mocks.media.findById).not.toHaveBeenCalled()
    },
  )

  it.each(['{', '{}', '[{}]'])(
    'leaves invalid requests to native validation: %s',
    async body => {
      expect(
        await mediaDeletionResponse(
          context('/_emdash/api/mcp', editor, 'POST', body),
        ),
      ).toBeNull()
      expect(mocks.media.findById).not.toHaveBeenCalled()
    },
  )
})
