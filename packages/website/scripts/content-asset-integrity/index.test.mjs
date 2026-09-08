import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  MAX_SYNCED_CANONICAL_MEDIA_BYTES,
  auditCanonicalAssetReferences,
  auditTalkMaterialReferences,
  extractCanonicalAssetReferences,
  extractTalkMaterialReferences,
  findSyncedCanonicalAssetViolations,
} from './index.mjs'

describe('synced canonical media', () => {
  it('rejects large video and PDF files while allowing small or optimized assets', () => {
    const violations = findSyncedCanonicalAssetViolations([
      file('synced/notes/assets/demo.mp4', MAX_SYNCED_CANONICAL_MEDIA_BYTES + 1),
      file('synced/essays/assets/book.pdf', MAX_SYNCED_CANONICAL_MEDIA_BYTES + 1),
      file('synced/notes/assets/short.mp4', MAX_SYNCED_CANONICAL_MEDIA_BYTES),
      file('synced/notes/images/poster.webp', MAX_SYNCED_CANONICAL_MEDIA_BYTES + 1),
    ])

    assert.deepEqual(violations.map(({ filePath }) => filePath), [
      'synced/essays/assets/book.pdf',
      'synced/notes/assets/demo.mp4',
    ])
  })
})

describe('canonical article asset references', () => {
  it('extracts canonical links from Markdown and HTML', () => {
    const references = extractCanonicalAssetReferences(`
[Book](https://assets.amaral.codes/essays/example/book.pdf)
<video src="https://assets.amaral.codes/reviews/example/demo.mp4"></video>
[External](https://example.com/ignored.pdf)
`, 'synced/example.md')

    assert.deepEqual(references, [
      reference('https://assets.amaral.codes/essays/example/book.pdf', 'book.pdf', 'synced/example.md'),
      reference('https://assets.amaral.codes/reviews/example/demo.mp4', 'demo.mp4', 'synced/example.md'),
    ])
  })

  it('reports a failed remote asset with its canonical staging path', async () => {
    const references = [
      reference('https://assets.amaral.codes/reviews/example/demo.mp4', 'demo.mp4'),
    ]
    const violations = await auditCanonicalAssetReferences(references, {
      fetcher: async () => new Response(null, { status: 404 }),
      fileExists: async filePath => filePath === '/staging/reviews/example/demo.mp4',
      formatPath: filePath => filePath.replace(/^\//, ''),
      stagingRoot: '/staging',
    })

    assert.equal(violations.length, 1)
    assert.match(violations[0].message, /staging\/reviews\/example\/demo\.mp4/u)
  })
})

describe('talk material references', () => {
  it('extracts structured material URLs from talk frontmatter', () => {
    const references = extractTalkMaterialReferences(`---
title: Example
talk:
  materials:
    - label: Slides
      type: pdf
      url: https://assets.example.com/talks/example/slides.pdf
    - label: Deck
      type: keynote
      url: /talks/example/slides.key
---
Body.
`, 'talks/example.md')

    assert.deepEqual(references, [
      {
        filePath: 'talks/example.md',
        label: 'Slides',
        url: 'https://assets.example.com/talks/example/slides.pdf',
      },
      {
        filePath: 'talks/example.md',
        label: 'Deck',
        url: '/talks/example/slides.key',
      },
    ])
  })

  it('accepts reachable object-storage and existing local material URLs', async () => {
    const references = [
      reference('https://assets.example.com/talks/example/slides.pdf'),
      reference('/talks/example/notes.pdf'),
    ]
    const audit = await auditTalkMaterialReferences(references, {
      fetcher: async () => new Response(null, { status: 206 }),
      fileExists: async filePath => filePath === '/public/talks/example/notes.pdf',
      publicRoot: '/public',
      stagingRoot: '/staging',
    })

    assert.deepEqual(audit, [])
  })

  it('reports remote failures with an actionable staged-source hint', async () => {
    const references = [
      reference('https://assets.example.com/talks/example/slides.pdf'),
      reference('https://assets.example.com/talks/missing/slides.pdf'),
    ]
    const violations = await auditTalkMaterialReferences(references, {
      fetcher: async () => new Response(null, { status: 404 }),
      fileExists: async filePath => filePath === '/staging/talks/example/slides.pdf',
      formatPath: filePath => filePath.replace(/^\//, ''),
      publicRoot: '/public',
      stagingRoot: '/staging',
    })

    assert.equal(violations.length, 2)
    assert.match(violations[0].message, /HTTP 404/u)
    assert.match(violations[0].message, /staging\/talks\/example\/slides\.pdf/u)
    assert.match(violations[0].message, /upload/u)
    assert.match(violations[1].message, /no staged source/u)
  })
})

function file(filePath, size) {
  return { filePath, size }
}

function reference(url, label = 'Slides', filePath = 'talks/example.md') {
  return { filePath, label, url }
}
