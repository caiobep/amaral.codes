import { expect, it } from 'vitest'
import { publicCmsMetadata } from './metadata'

const metadata = {
  title: 'A note',
  category: 'note',
  createdAt: new Date('2026-10-10T12:00:00Z'),
}

it('uses the native publish date when a date override is blank or null', () => {
  const publishedAt = new Date('2026-10-11T12:00:00Z')
  for (const date of ['', null, undefined]) {
    expect(publicCmsMetadata({ ...metadata, date, publishedAt }).date).toBe(
      '2026-10-11T12:00:00.000Z',
    )
  }
  expect(publicCmsMetadata(metadata).date).toBe('2026-10-10T12:00:00.000Z')
})

it('uses an explicit historical date without changing the native publish date', () => {
  expect(publicCmsMetadata({ ...metadata, date: '2025-02-01' }).date).toBe(
    '2025-02-01',
  )
})

it('preserves native topic labels and excludes private taxonomy identifiers', () => {
  const data = publicCmsMetadata({
    ...metadata,
    topics: ['legacy-topic'],
    terms: { topics: [{ slug: 'swiftui', label: 'SwiftUI', id: 'private-term' }] },
  })
  expect(data.topics).toEqual(['SwiftUI'])
  expect(JSON.stringify(data)).not.toContain('private-term')
  expect(publicCmsMetadata({ ...metadata, terms: {} }).topics).toEqual([])
  expect(publicCmsMetadata({
    ...metadata,
    terms: { topics: [{ slug: 'publishing' }] },
  }).topics).toEqual(['publishing'])
})

it('retains legacy topic values until native taxonomy hydration is available', () => {
  expect(publicCmsMetadata({ ...metadata, topics: ['publishing'] }).topics).toEqual(
    ['publishing'],
  )
  expect(publicCmsMetadata({ ...metadata, topics: null }).topics).toEqual([])
})

it('rejects malformed metadata before it can enter public indexes', () => {
  expect(() => publicCmsMetadata({ ...metadata, title: ' ' })).toThrow()
  expect(() => publicCmsMetadata({ ...metadata, date: 'tomorrow' })).toThrow()
  expect(() => publicCmsMetadata({ ...metadata, terms: null })).toThrow()
  expect(() => publicCmsMetadata({ ...metadata, terms: { topics: ['text'] } })).toThrow()
  expect(() => publicCmsMetadata({ ...metadata, category: 'podcast' })).toThrow()
  expect(() => publicCmsMetadata({ ...metadata, excerpt: 'undefined' })).toThrow()
})
