import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createNotionDatabaseSource } from './index.ts'

test('resolves a database before listing its rows', async () => {
  const notion = {
    databases: {
      retrieve: () => Promise.resolve({ data_sources: [{ id: 'podcasts-source' }] }),
    },
    dataSources: {
      query: ({ data_source_id }: { data_source_id: string }) => Promise.resolve({
        object: 'list',
        results: [page('episode-1')],
        has_more: false,
        next_cursor: null,
        requestedSource: data_source_id,
      }),
    },
  }

  const source = createNotionDatabaseSource(notion as never)
  const rows = await source.list('podcasts-database')

  assert.deepEqual(rows.map(row => row.id), ['episode-1'])
})

test('rejects databases with an ambiguous data source', async () => {
  const notion = {
    databases: {
      retrieve: () => Promise.resolve({ data_sources: [{ id: 'one' }, { id: 'two' }] }),
    },
  }

  const source = createNotionDatabaseSource(notion as never)
  await assert.rejects(
    () => source.list('podcasts-database'),
    /exactly one data source/,
  )
})

function page(id: string) {
  return { object: 'page', id, properties: {}, url: `https://notion.so/${id}` }
}
