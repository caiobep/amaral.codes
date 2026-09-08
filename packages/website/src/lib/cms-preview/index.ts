import { entrySchema } from '@amaral.codes/content-contract'
import type { CollectionEntry } from 'astro:content'
import { CMS_ORIGIN } from './origin'

export { CMS_ORIGIN } from './origin'
export const PREVIEW_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Content-Security-Policy': `frame-ancestors ${CMS_ORIGIN}`,
  Vary: 'Cookie',
}

interface PreviewDocument {
  id: string
  data: unknown
  html: string
}

function isPreviewDocument(value: unknown): value is PreviewDocument {
  if (!value || typeof value !== 'object') return false
  const fields = value as Partial<PreviewDocument>
  return typeof fields.id === 'string' && 'data' in fields && typeof fields.html === 'string'
}

export async function fetchPreview(request: Request, id: string, fetcher = fetch) {
  const revision = new URL(request.url).searchParams.get('revision') === 'published' ? 'published' : 'draft'
  const headers = new Headers()
  for (const name of ['cookie', 'origin', 'sec-fetch-site']) {
    const value = request.headers.get(name)
    if (value !== null) headers.set(name, value)
  }
  return fetcher(`${CMS_ORIGIN}/api/entries/${encodeURIComponent(id)}/preview?revision=${revision}`, {
    headers,
    cache: 'no-store',
  })
}

export function parsePreview(value: unknown): CollectionEntry<'entries'> {
  if (!isPreviewDocument(value)) throw new Error('Invalid CMS preview response.')
  return {
    id: value.id,
    collection: 'entries',
    data: entrySchema.parse(value.data),
    rendered: { html: value.html, metadata: { imagePaths: [] } },
  }
}
