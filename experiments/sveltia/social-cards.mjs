import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import yaml from 'js-yaml'
import { sharingArtwork } from './editor/sharing-artwork.mjs'

const escapeMarkup = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

async function textLayer(value, { fonts, serif = false, size, color = '#151a19', width = 1056 }) {
  const family = serif ? 'Instrument Serif' : 'Instrument Sans'
  const filename = serif ? 'InstrumentSerif-Regular.ttf' : 'InstrumentSans.ttf'
  return sharp({ text: {
    text: `<span foreground="${color}" insert_hyphens="false">${escapeMarkup(value)}</span>`,
    font: `${family} ${size}`, fontfile: path.join(fonts, filename),
    width, rgba: true, wrap: 'word-char',
  } }).png().toBuffer({ resolveWithObject: true })
}

async function summaryLayer(summary, fonts) {
  let value = summary
  let layer = await textLayer(value, { fonts, size: 25, color: '#5f6965' })
  while (layer.info.height > 60) {
    value = Array.from(value).slice(0, -8).join('').trimEnd()
    layer = await textLayer(value + '…', { fonts, size: 25, color: '#5f6965' })
  }
  return layer
}

export async function renderSocialCard(data, fonts) {
  // CoreText ignores per-file fonts on macOS; Fontconfig uses the same bundled fonts as CI.
  process.env.PANGOCAIRO_BACKEND = 'fc'
  process.env.FONTCONFIG_FILE = path.join(fonts, 'fonts.conf')
  const artwork = sharingArtwork(data)
  let size = artwork.fontSize
  let title = await textLayer(artwork.title, { fonts, serif: true, size })
  while (title.info.height > 245 && size > 24) {
    size -= 2
    title = await textLayer(artwork.title, { fonts, serif: true, size })
  }
  const layers = []
  for (const [value, options, top] of [
    ['Caio Amaral', { serif: true, size: 38 }, 44],
    [artwork.metadata.toUpperCase(), { size: 20, color: '#5f6965' }, 136],
    ['amaral.codes', { size: 21, color: '#5f6965' }, 561],
  ]) {
    const layer = await textLayer(value, { fonts, ...options })
    layers.push({ input: layer.data, left: 72, top })
  }
  layers.push({ input: title.data, left: 72, top: 191 })
  if (artwork.summary) {
    const summary = await summaryLayer(artwork.summary, fonts)
    layers.push({ input: summary.data, left: 72, top: 460 })
  }
  for (const top of [106, 535]) layers.push({ input: { create: { width: 1056, height: 1, channels: 3, background: '#d2d8d4' } }, left: 72, top })
  return sharp({ create: { width: 1200, height: 630, channels: 3, background: '#ffffff' } }).composite(layers).png().toBuffer()
}

export async function generateSocialCards(entries, website, options = {}) {
  const directory = path.join(options.publicDirectory ?? path.join(website, 'public'), 'social/posts')
  const fonts = options.fonts ?? path.join(website, 'scripts/social-cards/fonts')
  await fs.rm(directory, { recursive: true, force: true })
  await fs.mkdir(directory, { recursive: true })
  for (const [filename, document] of entries) {
    const header = document.match(/^---\n([\s\S]*?)\n---\n/u)
    const data = yaml.load(header[1], { schema: yaml.JSON_SCHEMA })
    if (data.sharing?.image) continue
    const image = await renderSocialCard(data, fonts)
    const hash = createHash('sha256').update(image).digest('hex').slice(0, 12)
    const name = `${path.basename(filename, '.md')}-${hash}.png`
    await fs.writeFile(path.join(directory, name), image)
    data.sharing = { ...data.sharing, image: `/social/posts/${name}`, imageAlt: `${sharingArtwork(data).title} — Caio Amaral` }
    entries.set(filename, `---\n${yaml.dump(data, { lineWidth: -1, noRefs: true })}---\n${document.slice(header[0].length)}`)
  }
}
