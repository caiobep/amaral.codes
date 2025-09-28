import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NOTION_API_KEY = process.env.NOTION_API_KEY ?? 'test-api-key'
process.env.NOTION_BLOG_DATABASE = process.env.NOTION_BLOG_DATABASE ?? 'test-db'
process.env.NOTION_BLOG_TAG = process.env.NOTION_BLOG_TAG ?? 'test-tag'

test('getBlogpostPages forwards database id, tag and pagination to client', async () => {
  const calls: any[] = []
  const stubClient = {
    request: async (config: any) => {
      calls.push(config)
      return { results: [], next_cursor: null }
    },
  }

  const { getBlogpostPages } = await import('./getBlogPosts.ts')

  await getBlogpostPages({
    databaseId: 'database-123',
    tagId: 'tag-123',
    startCursor: 'cursor-1',
    notionClient: stubClient as any,
  })

  assert.equal(calls.length, 1)
  const [call] = calls
  assert.equal(call.path, 'databases/database-123/query')
  assert.equal(call.method, 'post')
  assert.equal(call.body.start_cursor, 'cursor-1')
  assert.equal(call.body.filter.relation.contains, 'tag-123')
})

test('getBlogpostPages can disable tag filter when tagId is null', async () => {
  const calls: any[] = []
  const stubClient = {
    request: async (config: any) => {
      calls.push(config)
      return { results: [], next_cursor: null }
    },
  }

  const { getBlogpostPages } = await import('./getBlogPosts.ts')

  await getBlogpostPages({
    databaseId: 'database-123',
    tagId: null,
    notionClient: stubClient as any,
  })

  const [call] = calls
  assert.equal(call.body.filter, undefined)
})

test('getBlogpostMetadataById maps page response to metadata shape', async () => {
  const { getBlogpostMetadataById } = await import('./getBlogPosts.ts')

  const stubPage = {
    id: 'page-1',
    created_time: '2024-01-01',
    properties: {
      Tags: { relation: [{ id: 'tag-1' }] },
      Summary: { rich_text: [{ plain_text: 'Summary' }] },
      Name: { title: [{ plain_text: 'Title' }] },
      'Time to Read': { rich_text: [{ plain_text: '3 min' }] },
    },
  }

  const result = await getBlogpostMetadataById('page-1', {
    pages: {
      retrieve: async () => stubPage,
    },
  } as any)

  assert.deepEqual(result, {
    id: 'page-1',
    date: '2024-01-01',
    title: 'Title',
    summary: 'Summary',
    readTime: '3 min',
    tagIds: ['tag-1'],
  })
})

test('getAllBlogpostPageMetadata iterates through pagination', async () => {
  const { getAllBlogpostPageMetadata } = await import('./getBlogPosts.ts')

  const pages = [{
    id: 'page-1',
    created_time: '2024-01-01',
    properties: {
      Tags: { relation: [{ id: 'tag-1' }] },
      Summary: { rich_text: [{ plain_text: 'Summary' }] },
      Name: { title: [{ plain_text: 'Title' }] },
      'Time to Read': { rich_text: [{ plain_text: '3 min' }] },
    },
  }]

  const stubClient = {
    request: async (_config: any) => {
      if (!stubClient._called) {
        stubClient._called = true
        return { results: pages, next_cursor: 'cursor-1' }
      }
      return { results: pages, next_cursor: null }
    },
    _called: false,
  }

  const results = await getAllBlogpostPageMetadata({
    notionClient: stubClient as any,
  })

  assert.equal(results.length, 2)
  assert.equal(results[0].id, 'page-1')
})
