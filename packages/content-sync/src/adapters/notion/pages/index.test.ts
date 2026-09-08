import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createNotionCollectionSource } from './index.ts'

test('reads every page from a data source', async () => {
  const cursors: (string | undefined)[] = []
  const notion = {
    dataSources: {
      query: ({ start_cursor }: { start_cursor?: string }) => {
        cursors.push(start_cursor)
        return Promise.resolve(start_cursor
          ? { results: [page('page-2')], has_more: false, next_cursor: null }
          : { results: [page('page-1')], has_more: true, next_cursor: 'next' })
      },
    },
  }

  const source = createNotionCollectionSource(notion as never)
  const result = await source.list('source-1')

  assert.deepEqual(result.map(item => item.id), ['page-1', 'page-2'])
  assert.deepEqual(cursors, [undefined, 'next'])
})

test('rejects the complete result when any data-source row is partial', async () => {
  const notion = {
    dataSources: {
      query: () => Promise.resolve({
        results: [page('page-1'), { object: 'page', id: 'partial-page' }],
        has_more: false,
        next_cursor: null,
      }),
    },
  }

  const source = createNotionCollectionSource(notion as never)

  await assert.rejects(
    source.list('source-1'),
    /partial data-source row/,
  )
})

function page(id: string): Record<string, unknown> {
  return { object: 'page', id, properties: {}, url: `https://notion.so/${id}` }
}
