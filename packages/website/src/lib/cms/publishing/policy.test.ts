import { beforeEach, expect, it, vi } from 'vitest'
import { publicationProblem, type PublicPosition } from './policy'

const checks = {
  publicPositions: vi.fn<() => Promise<PublicPosition[]>>(),
  mediaKey: vi.fn<(id: string) => Promise<string>>(),
  mediaReady: vi.fn<(key: string) => Promise<void>>(),
}

function post(data: Record<string, unknown> = {}, slug: unknown = 'a-note') {
  return {
    id: 'native-post-id',
    slug,
    createdAt: '2026-10-11T12:00:00Z',
    data: { title: 'A note', category: 'note', content: [], ...data },
  }
}

beforeEach(() => {
  checks.publicPositions.mockReset().mockResolvedValue([])
  checks.mediaKey.mockReset().mockResolvedValue('stored-photo.png')
  checks.mediaReady.mockReset().mockResolvedValue(undefined)
})

it('accepts a dated native post without manual date, topics or a featured position', async () => {
  expect(await publicationProblem(post(), checks)).toBeUndefined()
})

it('accepts blank date overrides and empty native content using native publication metadata', async () => {
  for (const date of [null, '', undefined]) {
    for (const content of [null, undefined, []]) {
      const value = { ...post({ date, content }), publishedAt: '2026-10-11T13:00:00Z' }
      expect(await publicationProblem(value, checks)).toBeUndefined()
    }
  }
})

it('rejects missing, uppercase and internal-ID URL slugs before reading public indexes', async () => {
  for (const slug of [null, '', 'Uppercase', 'native-post-id']) {
    expect(await publicationProblem(post({}, slug), checks)).toMatch(/slug/u)
  }
  expect(checks.publicPositions).not.toHaveBeenCalled()
})

it('rejects whitespace titles, invalid dates and incomplete podcast metadata', async () => {
  for (const data of [{ title: ' ' }, { date: 'tomorrow' }, { category: 'podcast' }]) {
    expect(await publicationProblem(post(data), checks)).toMatch(/^Cannot publish:/u)
  }
  expect(checks.publicPositions).not.toHaveBeenCalled()
})

it('checks reference-only images on a clone without rewriting the authoring document', async () => {
  const content = [{ _type: 'image', _key: 'photo', asset: { _ref: 'native-photo' } }]
  const value = post({ content, featured_image: { id: 'hero-photo' } })
  expect(await publicationProblem(value, checks)).toBeUndefined()
  expect(checks.mediaKey.mock.calls).toEqual([['native-photo'], ['hero-photo']])
  expect(checks.mediaReady).toHaveBeenCalledWith('stored-photo.png')
  expect(content[0]?.asset).toEqual({ _ref: 'native-photo' })
})

it('checks supplied image storage keys instead of trusting authoring metadata', async () => {
  const content = [{ _type: 'image', _key: 'photo', asset: { meta: { storageKey: 'gone.png' } } }]
  checks.mediaReady.mockRejectedValue(new Error('Choose an uploaded image that is ready.'))
  expect(await publicationProblem(post({ content }), checks)).toContain('uploaded image')
  expect(checks.mediaKey).not.toHaveBeenCalled()
  expect(checks.mediaReady).toHaveBeenCalledWith('gone.png')
})

it('refuses missing internal uploads referenced from native HTML', async () => {
  const content = [{ _type: 'htmlBlock', _key: 'html', html: '<img src="/_emdash/api/media/file/gone.png">' }]
  checks.mediaReady.mockRejectedValue(new Error('Choose an uploaded image that is ready.'))
  expect(await publicationProblem(post({ content }), checks)).toContain('uploaded image')
  expect(checks.mediaReady).toHaveBeenCalledWith('gone.png')
})

it('refuses unavailable images and unsafe body links with a bounded editor message', async () => {
  checks.mediaKey.mockRejectedValue(new Error('Choose an uploaded image that is ready.'))
  expect(await publicationProblem(post({ featured_image: { id: 'gone' } }), checks))
    .toContain('Choose an uploaded image')
  const content = [{
    _type: 'block',
    _key: 'unsafe-link',
    children: [{ _type: 'span', text: 'Link', marks: ['bad-link'] }],
    markDefs: [{ _type: 'link', _key: 'bad-link', href: 'javascript:alert(1)' }],
  }]
  const reason = await publicationProblem(post({ content }), checks)
  expect(reason).toMatch(/^Cannot publish:/u)
  expect(reason?.length).toBeLessThanOrEqual(500)
})

it('rejects body blocks that the native article renderer cannot render', async () => {
  for (const content of [[null], [{ _type: 'block' }], [{ _key: 'empty' }]]) {
    expect(await publicationProblem(post({ content }), checks)).toMatch(/native type and key|Cannot publish:/u)
  }
})

it('refuses collisions with file posts and published CMS posts', async () => {
  checks.publicPositions.mockResolvedValue([
    { id: 'file:a-note', slug: 'a-note', featuredOrder: 1 },
  ])
  expect(await publicationProblem(post(), checks)).toContain('URL slug is already used')
  checks.publicPositions.mockResolvedValue([
    { id: 'other-native-post', slug: 'other-post', featuredOrder: 10 },
  ])
  expect(await publicationProblem(post({ featured_order: 10 }), checks))
    .toContain('featured position is already used')
})

it('allows republishing the same position while excluding the entry itself', async () => {
  checks.publicPositions.mockResolvedValue([
    { id: 'native-post-id', slug: 'a-note', featuredOrder: 10 },
  ])
  expect(await publicationProblem(post({ featured_order: 10 }), checks)).toBeUndefined()
  expect(await publicationProblem(post({ featured_order: 11 }), checks)).toBeUndefined()
})

it('fails closed when publishing checks cannot complete', async () => {
  checks.publicPositions.mockRejectedValue('unavailable')
  expect(await publicationProblem(post(), checks))
    .toContain('Content could not be validated')
})
