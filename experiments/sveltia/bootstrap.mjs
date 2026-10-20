import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

export function validateSourcePin(configuration) {
  assert.deepEqual(Object.keys(configuration).sort(), ['repository', 'revision'])
  assert.equal(configuration.repository, 'caiobep/amaral.codes')
  assert(/^[a-f0-9]{40}$/u.test(configuration.revision ?? ''), 'Publish a reviewed canonical website commit and pin its full SHA before enabling this build')
  return configuration
}

export async function bootstrap(repository) {
  const pin = validateSourcePin(JSON.parse(await fs.readFile(path.join(repository, 'publishing/source.json'), 'utf8')))
  const source = path.join(repository, '.publishing/source')
  await fs.mkdir(source, { recursive: true })
  const git = args => execFileSync('git', args, { cwd: source, stdio: 'inherit' })
  git(['init', '--quiet'])
  git(['fetch', '--depth=1', `https://github.com/${pin.repository}.git`, pin.revision])
  git(['checkout', '--detach', '--force', 'FETCH_HEAD'])
  const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim()
  assert.equal(actual, pin.revision)
  execFileSync('npm', ['ci'], { cwd: source, stdio: 'inherit' })
  const { build } = await import(pathToFileURL(path.join(source, 'experiments/sveltia/build.mjs')).href)
  const filename = path.join(repository, 'publishing/media.json')
  const media = await fs.readFile(filename, 'utf8').then(JSON.parse).catch(error => {
    if (error.code !== 'ENOENT') throw error
    return undefined
  })
  const security = JSON.parse(await fs.readFile(path.join(repository, 'publishing/security.json'), 'utf8'))
  assert.deepEqual(Object.keys(security), ['versionUrlsProtected'])
  assert.equal(typeof security.versionUrlsProtected, 'boolean')
  const kind = process.env.WORKERS_CI_BRANCH && process.env.WORKERS_CI_BRANCH !== 'main' ? 'draft' : 'published'
  return build(repository, { source, media, kind, versionUrlsProtected: security.versionUrlsProtected })
}

if (process.argv[1] === new URL(import.meta.url).pathname) await bootstrap(process.cwd())
