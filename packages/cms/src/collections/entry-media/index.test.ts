import assert from 'node:assert/strict'
import type { Field, PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'
import { podcastFields, talkFields, validatePlayers, validatePublicUrl } from './index'

function child(parent: Field, name: string) {
  assert('fields' in parent)
  const field = parent.fields.find(field => 'name' in field && field.name === name)
  assert(field)
  return field
}

const req = { t: (key: string) => key, payload: { config: {} } } as PayloadRequest
const conditionContext = { user: null, blockData: {}, operation: 'create' as const, path: [] }

describe('conditional media authoring', () => {
  it.each([
    [podcastFields, 'podcast'], [talkFields, 'talk'],
  ])('shows the group only for its content category', (group, category) => {
    assert(typeof group !== 'string')
    const condition = group.admin?.condition
    assert(condition)
    expect(condition({ category }, {}, conditionContext)).toBe(true)
    expect(condition({ category: 'note' }, {}, conditionContext)).toBe(false)
  })

  it('offers an optional MP3 upload while requiring the original episode and players', () => {
    expect(child(podcastFields, 'audio')).toMatchObject({
      type: 'upload', relationTo: 'media', filterOptions: { mimeType: { equals: 'audio/mpeg' } },
    })
    expect(child(podcastFields, 'sourceUrl')).toMatchObject({ required: true })
    expect(child(podcastFields, 'players')).toMatchObject({ required: true, minRows: 1 })
  })

  it('shows only the selected PDF upload or public material fields', () => {
    const materials = child(talkFields, 'materials')
    expect(child(materials, 'file')).toMatchObject({
      type: 'upload', relationTo: 'media', filterOptions: { mimeType: { equals: 'application/pdf' } },
    })
    for (const name of ['file', 'url', 'type']) {
      const condition = child(materials, name).admin?.condition
      assert(condition)
      expect(condition({}, { source: 'upload' }, conditionContext)).toBe(name === 'file')
      expect(condition({}, { source: 'url' }, conditionContext)).toBe(name !== 'file')
    }
  })
})

describe('URL validation', () => {
  const options = { type: 'text', name: 'url', req } as Parameters<typeof validatePublicUrl>[1]

  it.each(['https://example.com/episode', 'https://example.com/slides.pdf'])('accepts %s', async (url) => {
    expect(await validatePublicUrl(url, options)).toBe(true)
  })

  it.each(['http://example.com', 'javascript:alert(1)', 'https://example.com?token=private'])('rejects %s', async (url) => {
    expect(await validatePublicUrl(url, options)).toBe('Use a public HTTPS URL without credentials.')
  })

  it('preserves required validation and optional empty values', async () => {
    expect(await validatePublicUrl('', { ...options, required: true })).not.toBe(true)
    expect(await validatePublicUrl(null, options)).toBe(true)
  })
})

describe('player validation', () => {
  const options = { type: 'array', name: 'players', req } as Parameters<typeof validatePlayers>[1]

  it('rejects duplicate services while retaining native minimum-row validation', async () => {
    expect(await validatePlayers([{ service: 'spotify' }, { service: 'spotify' }], options))
      .toBe('Use each podcast player once.')
    expect(await validatePlayers([], { ...options, required: true, minRows: 1 })).not.toBe(true)
  })

  it('accepts distinct services and lets child fields validate unfinished rows', async () => {
    expect(await validatePlayers([{ service: 'spotify' }, { service: 'overcast' }], options)).toBe(true)
    expect(await validatePlayers([{}], options)).toBe(true)
  })
})
