import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import yaml from 'js-yaml'
import { prepareEntry, validateEntry } from './build.mjs'

test('draft branches stop before reading or changing website files', () => {
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [fileURLToPath(new URL('./build.mjs', import.meta.url))],
        {
          env: { ...process.env, WORKERS_CI_BRANCH: 'cms/notes/private-draft' },
          stdio: 'pipe',
        },
      ),
    error => error.stderr.toString().includes('Draft branches must not deploy'),
  )
})

const entry = body =>
  `---\ntitle: Example\ndate: '2026-10-14'\ncategory: note\n---\n${body}`

test('publishing rejects workflow metadata, unsafe HTML, and duplicate URLs', () => {
  assert.throws(() =>
    validateEntry(
      'notes/example.md',
      entry('Text').replace('category: note', 'category: note\nstatus: draft'),
      new Set(),
    ),
  )
  assert.throws(() =>
    validateEntry(
      'notes/example.md',
      entry('<script>alert(1)</script>'),
      new Set(),
    ),
  )
  const slugs = new Set()
  validateEntry('notes/example.md', entry('Text'), slugs)
  assert.throws(() => validateEntry('essays/example.md', entry('Text'), slugs))
})

test('publishing preserves code examples and dedicated summaries', () => {
  const raw = entry('```html\n<script>example()</script>\n```').replace(
    'category: note',
    'category: note\nsummary: Secondary text',
  )
  assert.equal(
    validateEntry('notes/example.md', raw, new Set()).summary,
    'Secondary text',
  )
})

test('Sveltia date scalars remain strings in Astro input without changing the body', () => {
  for (const date of ['2026-10-18', '2026-10-18T07:00:00.000Z']) {
    const body = '\n```js\nconst value = "  exact bytes  "\n```\n'
    const raw = `---\ntitle: Publishing check\nsummary: Secondary text\ndate: ${date}\ncategory: note\n---\n${body}`
    const rendered = prepareEntry('entries/notes/check.md', raw, new Set(), new Map())
    const header = rendered.match(/^---\n([\s\S]*?)\n---\n/u)
    const metadata = yaml.load(header[1])
    assert.equal(metadata.date, date)
    assert.equal(metadata.summary, 'Secondary text')
    assert.equal(rendered.slice(header[0].length), body)
    assert.equal(validateEntry('notes/check.md', raw, new Set()).date, date)
  }
})

test('generated talk input retains the public contract and body while using protected materials', () => {
  const raw = entry('Exact talk description.').replace(
    'category: note',
    'category: talk\ntalk:\n  materials:\n    - label: Slides\n      type: pdf\n      url: https://assets.amaral.codes/talks/example/slides.pdf',
  )
  const materials = new Map()
  const rendered = prepareEntry('talks/example.md', raw, new Set(), materials)
  const metadata = validateEntry('talks/example.md', rendered, new Set())
  assert.equal(metadata.talk.materials[0].url, '/talks/example/slides.pdf')
  assert.deepEqual([...materials], [['/talks/example/slides.pdf', 'talks/example/slides.pdf']])
  assert(rendered.endsWith('Exact talk description.'))
  assert(raw.includes('https://assets.amaral.codes/'))
})
