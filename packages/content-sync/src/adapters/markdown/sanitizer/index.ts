import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Nodes } from 'mdast'
import sanitizeHtml from 'sanitize-html'
import {
  requirePublicHttpsUrl,
  requirePublicUrl,
} from '@amaral.codes/content-contract/public-url'

interface SourceRange {
  end: number
  start: number
}

interface ProtectedMarkdown {
  restore: (sanitized: string) => string
  source: string
}

const ALLOWED_IFRAME_FEATURES = new Set([
  'accelerometer',
  'autoplay',
  'clipboard-write',
  'encrypted-media',
  'fullscreen',
  'gyroscope',
  'picture-in-picture',
  'web-share',
])
const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-presentation'
const TABLE_HEADER_SCOPES = ['col', 'colgroup', 'row', 'rowgroup']
const URL_TAGS = new Set(['audio', 'iframe', 'img', 'source', 'track', 'video'])

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'audio',
    'br',
    'caption',
    'details',
    'figcaption',
    'figure',
    'hr',
    'iframe',
    'img',
    'source',
    'summary',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'track',
    'video',
  ],
  allowedAttributes: {
    audio: ['controls', 'preload', 'src'],
    details: ['open'],
    iframe: [
      'allow',
      'allowfullscreen',
      'loading',
      'referrerpolicy',
      'sandbox',
      'src',
      'title',
    ],
    img: ['alt', 'decoding', 'height', 'loading', 'referrerpolicy', 'src', 'width'],
    source: ['src', 'type'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan', { name: 'scope', values: TABLE_HEADER_SCOPES }],
    track: ['default', 'kind', 'label', 'src', 'srclang'],
    video: ['controls', 'height', 'poster', 'preload', 'src', 'width'],
  },
  allowedSchemes: ['https'],
  allowProtocolRelative: false,
  exclusiveFilter: frame => URL_TAGS.has(frame.tag) && !frame.attribs.src,
  transformTags: {
    audio: (tagName, attributes) => transformMedia(tagName, attributes),
    details: transformDetails,
    iframe: transformIframe,
    img: transformImage,
    source: (tagName, attributes) => transformSource(tagName, attributes),
    th: transformTableHeader,
    track: transformTrack,
    video: (tagName, attributes) => transformMedia(tagName, attributes),
  },
}

export function sanitizePublicMarkdown(markdown: string): string {
  const protectedMarkdown = protectMarkdownText(markdown)
  const sanitized = sanitizeHtml(protectedMarkdown.source, SANITIZE_OPTIONS)
  const restored = protectedMarkdown.restore(sanitized)
  assertPublicMarkdownUrls(restored)
  return restored
}

function protectMarkdownText(markdown: string): ProtectedMarkdown {
  const ranges = findHtmlRanges(markdown)
  const marker = createMarker(markdown)
  const protectedValues = new Map<string, string>()
  let cursor = 0
  let source = ''

  for (const range of ranges) {
    source += protectValue(markdown.slice(cursor, range.start), marker, protectedValues)
    source += markdown.slice(range.start, range.end)
    cursor = range.end
  }
  source += protectValue(markdown.slice(cursor), marker, protectedValues)

  return {
    source,
    restore: sanitized => [...protectedValues].reduce(
      (output, [placeholder, value]) => output.replaceAll(placeholder, value),
      sanitized,
    ),
  }
}

function findHtmlRanges(markdown: string): SourceRange[] {
  const ranges: SourceRange[] = []
  walkMarkdownTree(fromMarkdown(markdown), node => {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (node.type === 'html' && start !== undefined && end !== undefined) {
      ranges.push({ start, end })
    }
  })
  return ranges.sort((left, right) => left.start - right.start)
}

function protectValue(
  value: string,
  marker: string,
  protectedValues: Map<string, string>,
): string {
  if (!value) return ''
  const placeholder = `${marker}${String(protectedValues.size)}X`
  protectedValues.set(placeholder, value)
  return placeholder
}

function createMarker(markdown: string): string {
  let marker = 'AMARALMARKDOWNTEXTX'
  while (markdown.includes(marker)) marker += 'X'
  return marker
}

function assertPublicMarkdownUrls(markdown: string): void {
  walkMarkdownTree(fromMarkdown(markdown), node => {
    if (node.type === 'definition' || node.type === 'image' || node.type === 'link') {
      requirePublicUrl(node.url, 'Imported Markdown URL')
    }
  })
}

function walkMarkdownTree(node: Nodes, visit: (node: Nodes) => void): void {
  visit(node)
  if (!('children' in node)) return
  node.children.forEach(child => walkMarkdownTree(child, visit))
}

function transformIframe(
  tagName: string,
  attributes: sanitizeHtml.Attributes,
): sanitizeHtml.Tag {
  const src = readPublicHttpsUrl(attributes.src)
  if (!src) return { tagName, attribs: {} }

  const allow = sanitizeIframeFeatures(attributes.allow)
  return {
    tagName,
    attribs: {
      src,
      title: getIframeTitle(attributes.title),
      loading: 'lazy',
      referrerpolicy: 'no-referrer',
      sandbox: IFRAME_SANDBOX,
      allowfullscreen: '',
      ...(allow ? { allow } : {}),
    },
  }
}

function transformImage(
  tagName: string,
  attributes: sanitizeHtml.Attributes,
): sanitizeHtml.Tag {
  const src = readPublicUrl(attributes.src)
  if (!src) return { tagName, attribs: {} }

  return {
    tagName,
    attribs: {
      src,
      alt: attributes.alt ?? '',
      loading: 'lazy',
      decoding: 'async',
      referrerpolicy: 'no-referrer',
      ...readDimensions(attributes),
    },
  }
}

function transformMedia(
  tagName: string,
  attributes: sanitizeHtml.Attributes,
): sanitizeHtml.Tag {
  const src = readPublicUrl(attributes.src)
  if (!src) return { tagName, attribs: {} }

  return {
    tagName,
    attribs: {
      src,
      controls: '',
      preload: 'metadata',
      ...readDimensions(attributes),
      ...(readPublicUrl(attributes.poster) ? { poster: readPublicUrl(attributes.poster) } : {}),
    },
  }
}

function transformSource(
  tagName: string,
  attributes: sanitizeHtml.Attributes,
): sanitizeHtml.Tag {
  const src = readPublicUrl(attributes.src)
  if (!src) return { tagName, attribs: {} }
  return { tagName, attribs: { ...attributes, src } }
}

function transformDetails(
  tagName: string,
  attributes: sanitizeHtml.Attributes,
): sanitizeHtml.Tag {
  return { tagName, attribs: Object.hasOwn(attributes, 'open') ? { open: '' } : {} }
}

function transformTrack(
  tagName: string,
  attributes: sanitizeHtml.Attributes,
): sanitizeHtml.Tag {
  const track = transformSource(tagName, attributes)
  if (Object.hasOwn(track.attribs, 'default')) track.attribs.default = ''
  return track
}

function transformTableHeader(
  tagName: string,
  attributes: sanitizeHtml.Attributes,
): sanitizeHtml.Tag {
  // sanitize-html serializes rejected enum values as bare attributes.
  return {
    tagName,
    attribs: Object.fromEntries(Object.entries(attributes).filter(
      ([name, value]) => name !== 'scope' || TABLE_HEADER_SCOPES.includes(value),
    )),
  }
}

function sanitizeIframeFeatures(value: string | undefined): string {
  if (!value) return ''
  return value
    .split(';')
    .map(feature => feature.trim().toLowerCase())
    .filter(feature => ALLOWED_IFRAME_FEATURES.has(feature))
    .join('; ')
}

function getIframeTitle(value: string | undefined): string {
  const title = value?.trim()
  if (title) return title
  return 'Embedded content'
}

function readDimensions(attributes: sanitizeHtml.Attributes): sanitizeHtml.Attributes {
  return Object.fromEntries(
    ['height', 'width']
      .map(name => [name, attributes[name]] as const)
      .filter((entry): entry is readonly [string, string] => /^[1-9]\d*$/.test(entry[1] ?? '')),
  )
}

function readPublicHttpsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    return requirePublicHttpsUrl(value, 'Embedded content URL')
  } catch {
    return undefined
  }
}

function readPublicUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    return requirePublicUrl(value, 'Embedded media URL')
  } catch {
    return undefined
  }
}
