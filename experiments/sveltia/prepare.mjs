import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'
import Ajv from 'ajv'
import { collectArchive, hashBytes, writeArchive } from './archive.mjs'
import { createEditorConfig } from './config.mjs'
import { seedTopics } from './topics.mjs'

const experiment = path.resolve('experiments/sveltia')
const state = path.join(experiment, '.trial')
const content = path.join(state, 'content')
const editor = path.join(state, 'editor')
const site = path.join(state, 'site')
const website = path.resolve('packages/website')
const vendor = path.join(state, 'vendor/package')

async function write(filename, data) {
  await fs.mkdir(path.dirname(filename), { recursive: true })
  await fs.writeFile(filename, data, { flag: 'wx', mode: 0o600 })
}

function editorHtml(demonstration) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="same-origin">
<title>Caio Amaral · Publishing</title><link rel="icon" href="/favicon.svg">
${demonstration ? '<link rel="cms-seed-url" href="/seed/manifest.json">' : ''}
<link rel="cms-config-url" href="${demonstration ? '/demo/config.yml' : '/admin/config.yml'}" type="text/yaml">
</head><body><script src="/vendor/sveltia-cms.js"></script></body></html>\n`
}

async function prepareEditors(files) {
  const schema = JSON.parse(
    await fs.readFile(path.join(vendor, 'schema/sveltia-cms.json'), 'utf8'),
  )
  const validate = new Ajv({ strict: false, allErrors: true }).compile(schema)
  for (const demonstration of [false, true]) {
    const configuration = createEditorConfig({
      repository: 'caiobep/amaral-content',
      demonstration,
    })
    assert(validate(configuration), JSON.stringify(validate.errors))
    const folder = demonstration ? 'demo' : 'admin'
    await write(
      path.join(editor, folder, 'config.yml'),
      yaml.dump(configuration),
    )
    await write(
      path.join(editor, folder, 'index.html'),
      editorHtml(demonstration),
    )
  }
  await fs.cp(content, path.join(editor, 'seed'), {
    recursive: true,
    errorOnExist: true,
    force: false,
  })
  await write(
    path.join(editor, 'seed/manifest.json'),
    JSON.stringify({ files }),
  )
  await fs.mkdir(path.join(editor, 'vendor'), { recursive: true })
  await fs.copyFile(
    path.join(vendor, 'dist/sveltia-cms.js'),
    path.join(editor, 'vendor/sveltia-cms.js'),
  )
  await fs.copyFile(
    path.join(vendor, 'LICENSE.txt'),
    path.join(editor, 'vendor/LICENSE.txt'),
  )
  await fs.copyFile(
    path.join(website, 'public/favicon.svg'),
    path.join(editor, 'favicon.svg'),
  )
}

async function prepareSite() {
  for (const name of [
    'src',
    'public',
    'scripts',
    'astro.config.mjs',
    'tsconfig.json',
    'package.json',
  ]) {
    await fs.cp(path.join(website, name), path.join(site, name), {
      recursive: true,
      errorOnExist: true,
      force: false,
      filter: filename =>
        filename !== path.join(website, 'src/content/entries'),
    })
  }
  await fs.cp(
    path.join(content, 'entries'),
    path.join(site, 'src/content/entries'),
    { recursive: true },
  )
  await fs.cp(path.join(content, 'media'), path.join(site, 'public/media'), {
    recursive: true,
  })
  for (const name of ['admin', 'vendor']) {
    await fs.cp(path.join(editor, name), path.join(site, 'public', name), {
      recursive: true,
    })
  }
  await fs.symlink(
    path.join(website, 'node_modules'),
    path.join(site, 'node_modules'),
    'dir',
  )
}

assert(
  !(await fs.stat(content).catch(() => null)),
  'A content snapshot already exists; do not overwrite it',
)
const archive = await collectArchive(path.join(website, 'src/content/entries'))
assert.equal(archive.documents.length, 63)
assert.equal(archive.media.size, 25)
const files = await writeArchive(content, archive)
files.push(...await seedTopics(content, archive.documents))
await prepareEditors(files)
await prepareSite()
const receipt = {
  entries: archive.documents.length,
  images: archive.media.size,
  summaries: archive.documents.filter(document => document.metadata.summary)
    .length,
  categories: Object.fromEntries(
    [
      ...new Set(archive.documents.map(document => document.metadata.category)),
    ].map(category => [
      category,
      archive.documents.filter(
        document => document.metadata.category === category,
      ).length,
    ]),
  ),
  documents: archive.documents.map(
    ({ path: filename, slug, sourceHash, bodyHash, raw }) => ({
      path: filename,
      slug,
      sourceHash,
      bodyHash,
      hash: hashBytes(raw),
    }),
  ),
  media: [...archive.media].map(([filename, { hash }]) => ({
    path: filename,
    hash,
  })),
}
await write(
  path.join(state, 'preflight.json'),
  JSON.stringify(receipt, null, 2),
)
console.log(
  JSON.stringify({ ...receipt, documents: undefined, media: undefined }),
)
