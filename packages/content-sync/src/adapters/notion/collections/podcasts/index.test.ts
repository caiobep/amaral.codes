import assert from 'node:assert/strict'
import { test } from 'vitest'
import type { PageObjectResponse as NotionPage } from '@notionhq/client'
import { podcastsMapper } from './index.ts'

test('maps a public PodcastsDB row into podcast frontmatter', () => {
  const result = mapPodcast(createPage({
    Name: title('RebuildCast #23 - Estudo'),
    Created: createdTime('2021-09-08T11:20:00.000Z'),
    Tags: multiSelect('Rebuild Cast'),
    Description: text('We compare the study habits that survived real work.'),
    Link: url('https://open.spotify.com/episode/example'),
  }))

  assert.equal(result.slug, 'rebuildcast-23-estudo')
  assert.deepEqual(result.metadata, {
    title: 'RebuildCast #23 - Estudo',
    date: '2021-09-08T11:20:00.000Z',
    summary: 'We compare the study habits that survived real work.',
    category: 'podcast',
    topics: ['Rebuild Cast'],
    podcast: {
      show: 'RebuildCast',
      episode: '23',
      sourceUrl: 'https://open.spotify.com/episode/example',
      players: [{
        service: 'spotify',
        url: 'https://open.spotify.com/episode/example',
      }],
    },
  })
})

test('keeps podcast rows private when Notion has no public URL', () => {
  const page = createPage({ Name: title('Private recording') }, null)
  assert.equal(podcastsMapper.isPublished(page), false)
})

test.each([
  ['Lambda3 Podcast 142 - Estudo', ['Lambda3'], 'Lambda3 Podcast'],
  ['Tooling FM #9', [], 'Tooling FM'],
  ['#12', [], 'Podcast'],
] as const)('normalizes the show for %s', (name, tags, expected) => {
  const result = mapPodcast(createPage({
    Name: title(name),
    Created: createdTime('2021-09-08T11:20:00.000Z'),
    Tags: multiSelect(...tags),
    Description: text('A podcast episode.'),
    Link: url('https://podcasts.apple.com/ca/podcast/example/id1'),
  }))

  const podcast = result.metadata.podcast as { show: string }
  assert.equal(podcast.show, expected)
})

test('rejects incomplete and unsupported podcast records', () => {
  assert.throws(
    () => mapPodcast(createPage({ Name: title('Missing fields') })),
    /missing Link/,
  )
  assert.throws(
    () => mapPodcast(createPage({
      Name: title('Unknown player'),
      Created: createdTime('2021-09-08T11:20:00.000Z'),
      Description: text('A podcast episode.'),
      Link: url('https://example.com/episode'),
    })),
    /Unsupported podcast player/,
  )
})

function mapPodcast(page: NotionPage) {
  return podcastsMapper.map(page)
}

function createPage(
  properties: Record<string, unknown>,
  publicUrl: string | null = 'https://caicorre.notion.site/episode',
): NotionPage {
  return {
    object: 'page',
    id: 'podcast-1',
    created_time: '2026-07-01T00:00:00.000Z',
    public_url: publicUrl,
    properties,
  } as unknown as NotionPage
}

const title = (value: string) => ({ title: [{ plain_text: value }] })
const text = (value: string) => ({ rich_text: [{ plain_text: value }] })
const createdTime = (value: string) => ({ created_time: value })
const url = (value: string) => ({ url: value })
const multiSelect = (...values: string[]) => ({
  multi_select: values.map(name => ({ name })),
})
