import { Parser } from 'htmlparser2'
import { isPublicHttpsUrl } from '../../packages/content-contract/src/public-url/index.ts'

export function parseLinkMetadata(html, pageUrl) {
  const meta = new Map()
  let title = ''
  let inTitle = false
  const parser = new Parser({
    onopentag(name, attributes) {
      if (name === 'title') inTitle = true
      if (name !== 'meta') return
      const key = (attributes.property || attributes.name || '').toLowerCase()
      if (!meta.has(key) && attributes.content) meta.set(key, attributes.content)
    },
    ontext(text) { if (inTitle) title += text },
    onclosetag(name) { if (name === 'title') inTitle = false },
  })
  parser.end(html)
  const card = {
    url: pageUrl,
    title: cleanText(meta.get('og:title') || meta.get('twitter:title') || title, 180),
    description: cleanText(meta.get('og:description') || meta.get('description') || meta.get('twitter:description') || '', 320),
  }
  const image = resolveImage(meta.get('og:image') || meta.get('twitter:image'), pageUrl)
  if (image) card.imageUrl = image
  return card
}

function cleanText(value, limit) {
  return Array.from(value.replace(/\s+/gu, ' ').trim()).slice(0, limit).join('')
}

function resolveImage(value, pageUrl) {
  if (!value) return undefined
  try {
    const url = new URL(value, pageUrl).href
    return isPublicHttpsUrl(url) ? url : undefined
  } catch { return undefined }
}
