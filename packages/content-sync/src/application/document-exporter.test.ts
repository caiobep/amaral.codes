import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createDocumentExporter } from './document-exporter.ts'

test('coordinates reading, materializing, and writing a content document', async () => {
  const calls: string[] = []
  const exporter = createDocumentExporter<string>({
    resolveDestination: (root, identity) => `${root}/${identity.partition ?? ''}`,
    reader: {
      read: (source) => {
        calls.push(`read:${source}`)
        return Promise.resolve('source markdown')
      },
    },
    materializer: {
      materialize: (markdown, destination, source) => {
        calls.push(`materialize:${destination}:${markdown}:${source}`)
        return Promise.resolve('public markdown')
      },
    },
    writer: {
      write: (destination, document) => {
        calls.push(`write:${destination}:${document.slug}:${document.content}`)
        return Promise.resolve()
      },
    },
  })

  await exporter.export({
    identity: {
      metadata: {
        category: 'note',
        date: '2026-07-27',
        summary: 'Summary',
        title: 'Example',
        topics: [],
      },
      partition: 'notes',
      slug: 'example',
    },
    scope: '/content',
    source: 'page-1',
  })

  assert.deepEqual(calls, [
    'read:page-1',
    'materialize:/content/notes:source markdown:page-1',
    'write:/content/notes:example:public markdown',
  ])
})
