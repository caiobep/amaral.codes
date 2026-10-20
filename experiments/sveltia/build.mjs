import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import yaml from 'js-yaml'
import { entrySchema } from '../../packages/content-contract/src/metadata/index.ts'
import { checkPublicDocument } from '../../scripts/public-content-privacy/index.mjs'
import { checkPublicMarkdownHtml } from '../../scripts/public-markdown-html/index.mjs'
import { prepareTalkMaterials } from './talk-materials.mjs'
import { enrichLinkCards } from './link-cards.mjs'
import { generateSocialCards } from './social-cards.mjs'
import { validateTopics } from './topics.mjs'
import { projectLocalizedEntries } from './localization.mjs'
import { publishingTarget } from './build-policy.mjs'
import { prepareSiteAssets, writeLocalizedRoutes } from './site-assets.mjs'
import { writeBuildWorker } from './build-output.mjs'

export function validateEntry(filename, raw, slugs) {
  const header = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u)
  assert(header, `Missing frontmatter: ${filename}`)
  const metadata = entrySchema.parse(
    yaml.load(header[1], { schema: yaml.JSON_SCHEMA }),
  )
  assert.equal(
    checkPublicDocument(filename, raw).length,
    0,
    `Private metadata: ${filename}`,
  )
  assert.equal(
    checkPublicMarkdownHtml(filename, raw.slice(header[0].length)).length,
    0,
    `Unsafe HTML: ${filename}`,
  )
  const slug = path.basename(filename, '.md')
  assert(!slugs.has(slug), `Duplicate public URL: ${slug}`)
  slugs.add(slug)
  return metadata
}

export function prepareEntry(filename, raw, slugs, materials) {
  const metadata = validateEntry(filename, raw, slugs)
  prepareTalkMaterials(metadata, materials)
  // Astro treats unquoted YAML dates as Date objects; generated input needs strings.
  return raw.replace(
    /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u,
    () => `---\n${yaml.dump(metadata, { lineWidth: -1, noRefs: true })}---\n`,
  )
}

export async function build(repository, options = {}) {
  const target = publishingTarget(process.env.WORKERS_CI_BRANCH, options.kind ?? process.env.PUBLISHING_BUILD_KIND)
  assert(target.kind !== 'draft' || options.versionUrlsProtected === true, 'Verify owner-only Access for version URLs before building private drafts')
  const source = options.source ?? path.resolve(new URL('../..', import.meta.url).pathname)
  const website = path.join(source, 'packages/website')
  const output = path.join(repository, '.publishing/output')
  const publishedSite = options.siteUrl ?? 'https://amaral-publishing-preview.caiobep.workers.dev'
  const siteUrl = target.kind === 'draft' ? `https://${target.alias}-${new URL(publishedSite).host}` : publishedSite
  const sourceEntries = new Map()
  for await (const filename of fs.glob('entries/**/*.md', { cwd: repository })) {
    sourceEntries.set(filename, await fs.readFile(path.join(repository, filename), 'utf8'))
  }
  const legacyUrls = JSON.parse(await fs.readFile(path.join(repository, 'publishing/legacy-urls.json'), 'utf8'))
  const projected = projectLocalizedEntries(sourceEntries, legacyUrls)
  assert(projected.entries.size > 0, 'Refuse to replace the archive with an empty build')
  const materials = new Map()
  const entries = new Map()
  const slugs = new Set()
  for (const [filename, raw] of projected.entries) entries.set(filename, prepareEntry(filename, raw, slugs, materials))
  await validateTopics(repository, entries)
  await fs.rm(output, { recursive: true, force: true })
  await fs.mkdir(output, { recursive: true })
  const publicDirectory = await prepareSiteAssets(website, output, { siteUrl, media: options.media, draft: target.kind === 'draft', publishedSite })
  await fs.cp(path.join(repository, 'media'), path.join(publicDirectory, 'media'), { recursive: true })
  await fs.cp(path.join(repository, 'link-previews'), path.join(publicDirectory, 'link-previews'), { recursive: true }).catch(error => {
    if (error.code !== 'ENOENT') throw error
  })
  await enrichLinkCards(entries, repository, publicDirectory)
  await generateSocialCards(entries, website, { publicDirectory, fonts: new URL('./fonts/', import.meta.url).pathname })
  await writeLocalizedRoutes(publicDirectory, projected.routes)
  for (const [filename, document] of entries) {
    const destination = path.join(output, filename)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.writeFile(destination, document)
  }
  await fs.writeFile(path.join(output, 'talk-materials.json'), JSON.stringify(Object.fromEntries(materials), null, 2) + '\n')
  await writeBuildWorker(output, target, options)
  execFileSync('npm', ['exec', '--workspace', '@amaral.codes/website', '--', 'astro', 'build', '--force'], {
    cwd: source, stdio: 'inherit',
    env: { ...process.env,
      AMARAL_CONTENT_SOURCE: 'production', AMARAL_CMS_TRIAL: '0', AMARAL_CMS_PREVIEW: '0',
      AMARAL_PUBLISHING_DIR: output, AMARAL_PUBLISHING_SITE: siteUrl,
      AMARAL_PUBLISHING_DRAFT: target.kind === 'draft' ? '1' : '0',
    },
  })
  console.log(`Validated and built ${entries.size} entries from the canonical website source`)
  return { output, routes: projected.routes, target }
}

if (process.argv[1] === new URL(import.meta.url).pathname) await build(process.cwd())
