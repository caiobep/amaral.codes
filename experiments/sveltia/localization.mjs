import assert from 'node:assert/strict'
import path from 'node:path'
import yaml from 'js-yaml'
import { categoryFolders } from './config.mjs'

export const locales = ['en', 'pt-BR']
const isMedia = category => ['podcast', 'talk'].includes(category)

export function readLocalizedEntry(filename, raw) {
  const header = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u)
  assert(header, `Missing frontmatter: ${filename}`)
  const data = yaml.load(header[1], { schema: yaml.JSON_SCHEMA })
  const basename = path.basename(filename, '.md')
  const suffix = locales.find(locale => basename.endsWith(`.${locale}`))
  const slug = suffix ? basename.slice(0, -(suffix.length + 1)) : basename
  const language = suffix ?? (isMedia(data.category) ? data.language ?? data.talk?.language ?? (data.category === 'podcast' ? 'pt-BR' : 'en') : 'en')
  assert(locales.includes(language), `Unsupported language: ${filename}`)
  assert(!data.language || data.language === language, `Language conflicts with path: ${filename}`)
  return { filename, slug, language, data, body: raw.slice(header[0].length) }
}

export function projectLocalizedEntries(entries, legacyUrls = {}) {
  const groups = new Map()
  for (const [filename, raw] of entries) {
    const entry = readLocalizedEntry(filename, raw)
    const key = `${isMedia(entry.data.category) ? entry.data.category : 'posts'}/${entry.slug}`
    const group = groups.get(key) ?? []
    assert(!group.some(item => item.language === entry.language), `Duplicate translation: ${key}`)
    group.push(entry)
    groups.set(key, group)
  }
  const projected = new Map()
  const routes = []
  for (const [key, group] of groups) {
    const legacy = key.startsWith('posts/') ? legacyUrls[group[0].slug] : group[0].language
    const primary = legacy ?? (group.some(entry => entry.language === 'en') ? 'en' : group[0].language)
    assert(group.some(entry => entry.language === primary), `Keep the original language before publishing translations: ${key}`)
    const translations = group.map(entry => projectEntry(entry, { key, primary, legacy }))
    for (const item of translations) {
      assert(!routes.some(route => route.url === item.route.url), `Duplicate public URL: ${item.route.url}`)
      assert(!projected.has(item.filename), `Duplicate generated entry: ${item.filename}`)
      projected.set(item.filename, item.raw)
      routes.push({ ...item.route, translations: translations.map(item => item.route) })
    }
  }
  return { entries: projected, routes }
}

function projectEntry(entry, { key, primary, legacy }) {
  const isPrimary = entry.language === primary
  const rootUrl = legacy === entry.language
  const id = rootUrl ? entry.slug : `${entry.language.toLowerCase()}--${entry.slug}`
  const url = `${rootUrl ? '' : `/${entry.language.toLowerCase()}`}/posts/${entry.slug}`
  const filename = `entries/${categoryFolders[entry.data.category]}/${id}.md`
  const metadata = { ...entry.data, language: entry.language }
  if (!isMedia(entry.data.category)) metadata.translation = { key, primary: isPrimary, href: url }
  if (!isPrimary) delete metadata.featuredOrder
  return {
    filename,
    raw: `---\n${yaml.dump(metadata, { lineWidth: -1, noRefs: true })}---\n${entry.body}`,
    route: { id, url, language: entry.language, primary: isPrimary },
  }
}

export function migrateEntry(filename, raw, reviewedLanguage) {
  const entry = readLocalizedEntry(filename, raw)
  if (isMedia(entry.data.category)) return { source: filename, destination: filename, raw, body: entry.body }
  const language = reviewedLanguage ?? entry.data.language ?? 'en'
  assert(locales.includes(language), 'Unsupported reviewed language')
  const suffix = language === 'en' ? '' : `.${language}`
  const destination = `entries/posts/${entry.slug}${suffix}.md`
  const migrated = entry.data.language ? raw : raw.replace(/\r?\n---(?:\r?\n|$)/u, `\nlanguage: ${language}\n---\n`)
  return { source: filename, destination, raw: migrated, body: entry.body }
}

export function legacyUrlRegistry(changes) {
  return Object.fromEntries(changes.filter(change => change.destination.startsWith('entries/posts/'))
    .map(change => { const entry = readLocalizedEntry(change.destination, change.raw); return [entry.slug, entry.language] }))
}
