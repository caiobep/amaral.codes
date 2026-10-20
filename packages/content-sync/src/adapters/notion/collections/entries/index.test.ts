import assert from 'node:assert/strict'
import { test } from 'vitest'
import type { PageObjectResponse as NotionPage } from '@notionhq/client'
import { createNotionCollectionSource } from '../../pages/index.ts'
import { entriesMapper } from './index.ts'

test('maps a Notion entry into website frontmatter', () => {
  const result = mapEntry(createPage({
    Name: title('A useful entry'),
    Slug: text('useful-entry'),
    Type: select('Essay'),
    Status: select('Published'),
    Summary: text('What changed after I tried it.'),
    Language: select('pt-BR'),
    Date: date('2026-07-26'),
    Topics: multiSelect('Software', 'Interfaces'),
    'Featured order': number(2),
  }))

  assert.equal(result.slug, 'useful-entry')
  assert.equal(result.partition, 'essays')
  assert.deepEqual(result.metadata, {
    title: 'A useful entry',
    date: '2026-07-26',
    language: 'pt-BR',
    summary: 'What changed after I tried it.',
    category: 'essay',
    topics: ['Software', 'Interfaces'],
    featuredOrder: 2,
  })
})

test('maps podcast destinations only when supplied', () => {
  const result = mapEntry(createPage({
    Name: title('Episode 42'),
    Type: select('Podcast'),
    Summary: text('A conversation about the episode topic.'),
    Show: text('Example Show'),
    Episode: text('42'),
    'Source URL': url('https://example.com/42'),
    Spotify: url('https://open.spotify.com/episode/42'),
  }))

  assert.deepEqual(result.metadata.podcast, {
    show: 'Example Show',
    episode: '42',
    sourceUrl: 'https://example.com/42',
    players: [{
      service: 'spotify',
      url: 'https://open.spotify.com/episode/42',
    }],
    audioUrl: undefined,
    audioBytes: undefined,
  })
})

test('does not publish preview entries', () => {
  const page = createPage({
    Name: title('A preview entry'),
    Status: status('Preview'),
  })

  assert.equal(entriesMapper.isPublished(page), false)
})

test('maps the compact BlogDB schema without publishing unfinished rows', () => {
  const published = mapEntry(createPage({
    Name: title('A field note'),
    Status: status('Published'),
    Category: select('Interfaces'),
    'AI summary': text('What changed after I tested the interface.'),
    'Created At': formulaDate('2026-07-24'),
    'Created time override': date('2026-07-25'),
  }))
  const draftPage = createPage({
    Name: title('Still editing'),
    Status: status('Not started'),
  })

  assert.equal(entriesMapper.isPublished(draftPage), false)
  assert.deepEqual(published, {
    slug: 'a-field-note',
    partition: 'notes',
    metadata: {
      title: 'A field note',
      date: '2026-07-24',
      language: undefined,
      summary: 'What changed after I tested the interface.',
      category: 'note',
      topics: ['Interfaces'],
      featuredOrder: undefined,
    },
  })
})

test('publishes only rows whose source status is Published', async () => {
  const sourceStatuses = ['Done', 'Published', 'Archive', 'Draft']
  const notion = {
    dataSources: {
      query: () => {
        return Promise.resolve({
          results: sourceStatuses.map(sourceStatus => ({
            ...createPage({
              Name: title(`${sourceStatus} entry`),
              Status: status(sourceStatus),
            }),
            id: `page-${sourceStatus.toLowerCase()}`,
            url: `https://notion.so/page-${sourceStatus.toLowerCase()}`,
          })),
          has_more: false,
          next_cursor: null,
        })
      },
    },
  }

  const source = createNotionCollectionSource(notion as never)
  const entries = await source.list('entries-source')

  assert.deepEqual(
    entries.map(entry => entriesMapper.isPublished(entry)),
    [false, true, false, false],
  )
})

test('prefers an editorial summary override to generated summaries', () => {
  const result = mapEntry(createPage({
    Name: title('An edited entry'),
    Status: select('Published'),
    'Summary override': text('The final editorial summary.'),
    Summary: text('A legacy summary.'),
    'AI summary': text('A generated summary.'),
  }))

  assert.equal(result.metadata.summary, 'The final editorial summary.')
})

test('omits a summary when a published entry does not have one', () => {
  const result = mapEntry(createPage({
    Name: title('An older entry'),
    Status: status('Published'),
  }))

  assert.equal(result.metadata.summary, undefined)
})

test('uses a BlogDB category as the entry type when it is recognized', () => {
  const result = mapEntry(createPage({
    Name: title('A book review'),
    Category: select('Review'),
    Summary: text('What changed after reading it.'),
  }))

  assert.equal(result.partition, 'reviews')
  assert.equal(result.metadata.category, 'review')
  assert.deepEqual(result.metadata.topics, [])
})

test('maps talk material and falls back to stable defaults', () => {
  const result = mapEntry(createPage({
    Name: title('A practical workshop'),
    Type: select('Talk'),
    Summary: text('A workshop about the practical details.'),
    'Talk format': select('Workshop'),
    'Material URL': text('/talks/practical/slides.pdf'),
  }))

  assert.equal(result.slug, 'a-practical-workshop')
  assert.equal(result.partition, 'talks')
  assert.deepEqual(result.metadata.talk, {
    format: 'workshop',
    event: undefined,
    language: undefined,
    materials: [{
      label: 'Open material',
      type: 'pdf',
      url: '/talks/practical/slides.pdf',
    }],
  })
})

test('rejects podcast and talk entries missing required fields', () => {
  assert.throws(
    () => mapEntry(createPage({
      Name: title('Incomplete podcast'),
      Type: select('Podcast'),
      Summary: text('An incomplete podcast record.'),
      Spotify: url('https://open.spotify.com/episode/example'),
    })),
    /missing Show/,
  )
  assert.throws(
    () => mapEntry(createPage({
      Name: title('Incomplete talk'),
      Type: select('Talk'),
      Summary: text('An incomplete talk record.'),
    })),
    /missing Material URL/,
  )
})

test('rejects unsafe podcast destinations', () => {
  assert.throws(
    () => mapEntry(createPage({
      Name: title('Unsafe source'),
      Type: select('Podcast'),
      Summary: text('A podcast with an unsafe source.'),
      Show: text('Example Show'),
      'Source URL': url('javascript:alert(1)'),
      Spotify: url('https://open.spotify.com/episode/example'),
    })),
    /public HTTPS URL/,
  )
})

function mapEntry(page: NotionPage) {
  return entriesMapper.map(page)
}

function createPage(properties: Record<string, unknown>): NotionPage {
  return {
    object: 'page',
    id: 'page-1',
    created_time: '2026-07-01T00:00:00.000Z',
    properties,
  } as unknown as NotionPage
}

const title = (value: string) => ({ title: [{ plain_text: value }] })
const text = (value: string) => ({ rich_text: [{ plain_text: value }] })
const select = (value: string) => ({ select: { name: value } })
const status = (value: string) => ({ status: { name: value } })
const date = (value: string) => ({ date: { start: value } })
const formulaDate = (value: string) => ({
  formula: { type: 'date', date: { start: value } },
})
const number = (value: number) => ({ number: value })
const url = (value: string) => ({ url: value })
const multiSelect = (...values: string[]) => ({
  multi_select: values.map(name => ({ name })),
})
