const MAX_DESCRIPTION_LENGTH = 160
const ELLIPSIS = '...'
const GRAPHEME_SEGMENTER = new Intl.Segmenter('en', { granularity: 'grapheme' })
const CONTENT_BLOCK_PATTERN = /<(p|li|blockquote)(?=[\s>])[^>]*>([\s\S]*?)<\/\1>/giu
const NON_PROSE_PATTERN = /<(script|style|svg)(?=[\s>])[^>]*>[\s\S]*?<\/\1>/giu

interface ArticleDescriptionInput {
  contentHtml: string
  summary?: string
  title: string
}

const NAMED_ENTITIES = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
} as const

function normalizeText(value: string) {
  return value.replace(/\s+/gu, ' ').trim()
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#x([\da-f]+);/giu, (_entity, codePoint: string) => (
      String.fromCodePoint(Number.parseInt(codePoint, 16))
    ))
    .replace(/&#(\d+);/gu, (_entity, codePoint: string) => (
      String.fromCodePoint(Number.parseInt(codePoint, 10))
    ))
    .replace(/&(amp|apos|gt|lt|nbsp|quot);/gu, (_entity, name: string) => (
      NAMED_ENTITIES[name as keyof typeof NAMED_ENTITIES]
    ))
}

function extractText(markup: string) {
  return normalizeText(decodeHtmlEntities(
    markup
      .replace(NON_PROSE_PATTERN, ' ')
      .replace(/<[^>]*>/gu, ' '),
  ))
}

function extractContentText(contentHtml: string) {
  return [...contentHtml.matchAll(CONTENT_BLOCK_PATTERN)]
    .map((match) => extractText(match[2] ?? ''))
    .filter(Boolean)
    .join(' ')
}

function capDescription(value: string) {
  const characters = Array.from(
    GRAPHEME_SEGMENTER.segment(value),
    ({ segment }) => segment,
  )
  if (characters.length <= MAX_DESCRIPTION_LENGTH) return value

  const prefix = characters.slice(0, MAX_DESCRIPTION_LENGTH - ELLIPSIS.length).join('')
  const lastWordBoundary = prefix.lastIndexOf(' ')
  const truncated = lastWordBoundary > 0 ? prefix.slice(0, lastWordBoundary) : prefix
  return `${truncated}${ELLIPSIS}`
}

export function createArticleDescription({
  contentHtml,
  summary,
  title,
}: ArticleDescriptionInput) {
  const normalizedSummary = normalizeText(summary ?? '')
  const authoredSummary = normalizedSummary || undefined
  const contentText = extractContentText(contentHtml)
  const fallback = contentText === '' ? `${normalizeText(title)} by Caio Amaral.` : contentText
  const description = authoredSummary ?? fallback

  return capDescription(normalizeText(description))
}
