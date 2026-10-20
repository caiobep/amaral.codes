import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const command = fileURLToPath(new URL('./index.mjs', import.meta.url))
const entries = 'packages/website/src/content/entries'
const projects = 'packages/website/src/content/projects'
const fixtures = 'packages/website/tests/fixtures/content/entries'
const publicRoot = 'packages/website/public'

function createRepository(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-check-'))
  context.after(() => fs.rmSync(root, { recursive: true, force: true }))
  execFileSync('git', ['init', '--quiet', root])
  for (const directory of [entries, projects, fixtures, publicRoot]) {
    fs.mkdirSync(path.join(root, directory), { recursive: true })
  }
  return root
}

function write(root, filename, content) {
  const target = path.join(root, filename)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}

function run(root) {
  return spawnSync(process.execPath, [command], { cwd: root, encoding: 'utf8' })
}

test('one command accepts public content and ignores deleted tracked files', context => {
  const root = createRepository(context)
  write(root, `${entries}/note.md`, 'A public note. ![Diagram](./images/diagram.webp)')
  write(root, `${entries}/images/diagram.webp`, 'image fixture')
  write(root, 'removed.md', 'removed')
  execFileSync('git', ['add', 'removed.md'], { cwd: root })
  fs.unlinkSync(path.join(root, 'removed.md'))
  const result = run(root)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Content checks passed/)
})

for (const [filename, content, message] of [
  [`${entries}/note.md`, '---\nstatus: draft\n---\nPrivate draft fixture', /private workflow metadata/],
  [`${projects}/project.md`, '<script>alert(1)</script>', /HTML/],
  [`${fixtures}/note.md`, '[Link](https://example.com/?token=fixture)', /credential-bearing URL/],
  [`${entries}/note.md`, '![Diagram](./images/missing.webp)', /missing asset/],
  [`${entries}/note.md`, '[Audio](./episode.mp3)', /unsupported local media/],
  [`${entries}/images/unused.webp`, 'image fixture', /unused image/],
  [`${publicRoot}/talks/example/slides.pdf`, 'PDF fixture', /object storage/],
]) {
  test(`rejects ${message.source}`, context => {
    const root = createRepository(context)
    write(root, filename, content)
    const result = run(root)
    assert.equal(result.status, 1)
    assert.match(result.stderr, message)
    assert.doesNotMatch(result.stdout, /Content checks passed/)
  })
}

test('checks tracked presentations outside the deployable directory', context => {
  const root = createRepository(context)
  write(root, 'slides.key', 'presentation fixture')
  execFileSync('git', ['add', 'slides.key'], { cwd: root })
  const result = run(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /slides.key: canonical presentation files belong in object storage/)
})

test('checks untracked presentation symlinks in the deployable directory', context => {
  const root = createRepository(context)
  write(root, 'source.pdf', 'PDF fixture')
  fs.symlinkSync(path.join(root, 'source.pdf'), path.join(root, publicRoot, 'slides.pdf'))
  const result = run(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /slides.pdf: canonical presentation files belong in object storage/)
})

test('reports independent policy violations in the same run', context => {
  const root = createRepository(context)
  write(root, `${entries}/note.md`, '---\nstatus: draft\n---\n![Diagram](./missing.webp)')
  write(root, `${publicRoot}/slides.pdf`, 'PDF fixture')
  const result = run(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /private workflow metadata/)
  assert.match(result.stderr, /missing asset/)
  assert.match(result.stderr, /object storage/)
})
