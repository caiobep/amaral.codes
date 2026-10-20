import assert from 'node:assert/strict'
import test from 'node:test'
import { migrateEntry, legacyUrlRegistry, projectLocalizedEntries, readLocalizedEntry } from './localization.mjs'

const document = (extra = '', body = 'Exact body\n') => `---\ntitle: Example\ndate: '2026-10-19'\ncategory: note\n${extra}---\n${body}`

test('migration preserves exact body bytes and records existing URLs separately from authoring fields', () => {
  const raw = document('', '\n```js\nconst text = " exact ";\n```\n')
  const migrated = migrateEntry('entries/notes/example.md', raw)
  assert.equal(migrated.destination, 'entries/posts/example.md')
  assert.equal(readLocalizedEntry(migrated.destination, migrated.raw).body, migrated.body)
  assert.deepEqual(legacyUrlRegistry([migrated]), { example: 'en' })
  const media = document('talk:\n  language: pt-BR\n').replace('category: note', 'category: talk')
  assert.equal(migrateEntry('entries/talks/example.md', media).raw, media)
})

test('legacy Portuguese originals keep root URLs when English is added', () => {
  const source = new Map([
    ['entries/posts/example.pt-BR.md', document('language: pt-BR\nfeaturedOrder: 1\n', 'Texto\n')],
    ['entries/posts/example.md', document('language: en\nfeaturedOrder: 1\n')],
  ])
  const projected = projectLocalizedEntries(source, { example: 'pt-BR' })
  assert.deepEqual(projected.routes.map(route => route.url), ['/posts/example', '/en/posts/example'])
  assert(projected.entries.get('entries/notes/example.md').includes('featuredOrder: 1'))
  assert(!projected.entries.get('entries/notes/en--example.md').includes('featuredOrder'))
  assert(projected.entries.get('entries/notes/example.md').endsWith('Texto\n'))
  assert.equal(projected.routes[0].translations.length, 2)
})

test('Portuguese-first native entries need no save hook and keep URLs after adding English', () => {
  const source = new Map([['entries/posts/example.pt-BR.md', document('language: pt-BR\n')]])
  assert.equal(projectLocalizedEntries(source).routes[0].url, '/pt-br/posts/example')
  source.set('entries/posts/example.md', document('language: en\n'))
  const routes = projectLocalizedEntries(source).routes
  assert.deepEqual(routes.map(route => route.url), ['/pt-br/posts/example', '/en/posts/example'])
  assert.equal(routes.find(route => route.primary).language, 'en')
})

test('conflicting metadata, duplicate URLs, and removing a legacy original fail before output', () => {
  assert.throws(() => readLocalizedEntry('entries/posts/example.pt-BR.md', document('language: en\n')))
  assert.throws(() => projectLocalizedEntries(new Map([
    ['entries/posts/example.md', document()], ['entries/talks/example.md', document().replace('category: note', 'category: talk')],
  ]), { example: 'en' }))
  assert.throws(() => projectLocalizedEntries(new Map([
    ['entries/posts/example.pt-BR.md', document('language: pt-BR\n')],
  ]), { example: 'en' }), /Keep the original language/u)
})
