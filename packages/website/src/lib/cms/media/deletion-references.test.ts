import { beforeEach, describe, expect, it, vi } from 'vitest'
import { protectedPostReferences } from './deletion-references'

const mocks = vi.hoisted(() => ({
  content: { findMany: vi.fn() },
  revisions: { findById: vi.fn() },
}))
vi.mock('emdash/runtime', () => ({ getDb: () => Promise.resolve({}) }))
vi.mock('emdash', () => ({
  ContentRepository: vi.fn(function () {
    return mocks.content
  }),
  RevisionRepository: vi.fn(function () {
    return mocks.revisions
  }),
}))

const media = { id: 'media-id', storageKey: 'pixel.png' }
const image = { content: [{ _type: 'image', asset: { _ref: media.id } }] }

function storedPosts(published: unknown[], scheduled: unknown[] = []): void {
  mocks.content.findMany.mockImplementation(
    (_collection: string, options: { where: { status: string } }) =>
      Promise.resolve({
        items: options.where.status === 'published' ? published : scheduled,
      }),
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  storedPosts([])
})

describe('protected post media references', () => {
  it.each([
    image,
    { featured_image: { id: media.id, provider: 'local' } },
    {
      content: [
        { _type: 'image', asset: { meta: { storageKey: media.storageKey } } },
      ],
    },
    { content: [{ _type: 'file', url: '/_emdash/api/media/file/pixel.png' }] },
    {
      content: [
        {
          _type: 'htmlBlock',
          html: '<img src="/_emdash/api/media/file/pixel.png">',
        },
      ],
    },
  ])('protects published native media by ID or storage key', async data => {
    storedPosts([
      {
        status: 'published',
        data,
        scheduledAt: null,
        draftRevisionId: 'pending',
      },
    ])
    expect(await protectedPostReferences(media)).toBe(true)
    expect(mocks.revisions.findById).not.toHaveBeenCalled()
  })

  it('paginates every protected status through the native non-deleted query', async () => {
    mocks.content.findMany
      .mockResolvedValueOnce({ items: [], nextCursor: 'published-next' })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [], nextCursor: 'scheduled-next' })
      .mockResolvedValueOnce({
        items: [
          {
            status: 'scheduled',
            data: image,
            scheduledAt: 'future',
            draftRevisionId: null,
          },
        ],
      })
    expect(await protectedPostReferences(media)).toBe(true)
    expect(mocks.content.findMany.mock.calls).toEqual([
      ['posts', { where: { status: 'published' } }],
      ['posts', { where: { status: 'published' }, cursor: 'published-next' }],
      ['posts', { where: { status: 'scheduled' } }],
      ['posts', { where: { status: 'scheduled' }, cursor: 'scheduled-next' }],
    ])
  })
})

describe('scheduled post media references', () => {
  it.each(['published', 'scheduled'])(
    'protects the staged revision of a %s scheduled post',
    async status => {
      const post = {
        status,
        data: {},
        scheduledAt: 'future',
        draftRevisionId: 'revision',
      }
      storedPosts(
        status === 'published' ? [post] : [],
        status === 'scheduled' ? [post] : [],
      )
      mocks.revisions.findById.mockResolvedValue({ data: image })
      expect(await protectedPostReferences(media)).toBe(true)
      expect(mocks.revisions.findById).toHaveBeenCalledWith('revision')
    },
  )

  it('permits media only used by an unscheduled unpublished revision', async () => {
    storedPosts([
      {
        status: 'published',
        data: {},
        scheduledAt: null,
        draftRevisionId: 'revision',
      },
    ])
    mocks.revisions.findById.mockResolvedValue({ data: image })
    expect(await protectedPostReferences(media)).toBe(false)
    expect(mocks.revisions.findById).not.toHaveBeenCalled()
  })

  it('uses the scheduled snapshot rather than stale unpublished columns', async () => {
    storedPosts(
      [],
      [
        {
          status: 'scheduled',
          data: image,
          scheduledAt: 'future',
          draftRevisionId: 'revision',
        },
      ],
    )
    mocks.revisions.findById.mockResolvedValue({ data: {} })
    expect(await protectedPostReferences(media)).toBe(false)
  })

  it('refuses to approve deletion when the scheduled snapshot is missing', async () => {
    storedPosts(
      [],
      [
        {
          status: 'scheduled',
          data: {},
          scheduledAt: 'future',
          draftRevisionId: 'missing',
        },
      ],
    )
    mocks.revisions.findById.mockResolvedValue(null)
    await expect(protectedPostReferences(media)).rejects.toThrow(
      'Scheduled post revision is missing',
    )
  })
})
