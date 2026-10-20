import { cmsHtmlMediaUrls } from '../body-html'
import { usesEmbedHtml } from '../body-embed'
import { isPublishableUrl } from '../body-url'

export const mediaPrefix = '/_emdash/api/media/file/'
const canonicalMediaOrigin = 'https://amaral.codes'
const imagePaths = new Set(['/_image', '/_image/'])
const flatMediaKeyPattern = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9]+)?$/
const nativeUploadKeyPattern =
  /^(?:[0-7][0-9A-HJKMNP-TV-Z]{25}\.){2}[A-Za-z0-9]+$/

export function normalizeMediaKey(value: string): string | null {
  let key = value
  for (let layer = 0; layer < 4; layer++) {
    try {
      const decoded = decodeURIComponent(key)
      if (decoded === key)
        return flatMediaKeyPattern.test(key) || nativeUploadKeyPattern.test(key)
          ? key
          : null
      key = decoded
    } catch {
      return null
    }
  }
  return null
}

export function mediaKeyFromUrl(value: string): string | null {
  const url = urlFromValue(value, 'http://localhost')
  if (!url) return null
  if (!url.pathname.startsWith(mediaPrefix)) return null
  return normalizeMediaKey(url.pathname.slice(mediaPrefix.length))
}

export function urlFromValue(value: string, base: string | URL): URL | null {
  try {
    return new URL(value, base)
  } catch {
    return null
  }
}

export function isMediaRequest(url: URL): boolean {
  if (url.pathname.startsWith(mediaPrefix)) return true
  if (!imagePaths.has(url.pathname)) return false
  const source = urlFromValue(url.searchParams.get('href') ?? '', url)
  return source === null || source.pathname.startsWith(mediaPrefix)
}

export function requestMediaKey(url: URL): string | null {
  if (imagePaths.has(url.pathname))
    return mediaKeyFromUrl(url.searchParams.get('href') ?? '')
  return mediaKeyFromUrl(url.href)
}

export function referencesMedia(
  value: unknown,
  key: string,
  mediaId?: string,
): boolean {
  if (typeof value === 'string') return referencesStorageUrl(value, key)
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value))
    return value.some(item => referencesMedia(item, key, mediaId))
  const record = value as Record<string, unknown>
  return recordReferencesMedia(record, key, mediaId)
}

function recordReferencesMedia(
  record: Record<string, unknown>,
  key: string,
  mediaId?: string,
): boolean {
  if (record.storageKey === key) return true
  if (
    mediaId &&
    (imageReferencesId(record, mediaId) ||
      featuredImageReferencesId(record, mediaId))
  )
    return true
  if (htmlReferencesMedia(record, key)) return true
  return Object.values(record).some(item => referencesMedia(item, key, mediaId))
}

function htmlReferencesMedia(
  record: Record<string, unknown>,
  key: string,
): boolean {
  if (typeof record.html !== 'string') return false
  if (!rendersNativeHtml(record)) return false
  return cmsHtmlMediaUrls(record.html).some(url =>
    referencesStorageUrl(url, key),
  )
}

function referencesStorageUrl(url: string, key: string): boolean {
  return isNativeMediaUrl(url) && mediaKeyFromUrl(url) === key
}

export function isNativeMediaUrl(value: string): boolean {
  const url = urlFromValue(value, canonicalMediaOrigin)
  return (
    url?.origin === canonicalMediaOrigin && url.pathname.startsWith(mediaPrefix)
  )
}

function rendersNativeHtml(record: Record<string, unknown>): boolean {
  if (record._type === 'htmlBlock') return record.isolated !== true
  if (record._type !== 'embed' || typeof record.url !== 'string') return false
  return (
    isPublishableUrl(record.url) && usesEmbedHtml(record.url, record.provider)
  )
}

function featuredImageReferencesId(
  record: Record<string, unknown>,
  mediaId: string,
): boolean {
  const image = record.featured_image
  if (!image || typeof image !== 'object' || Array.isArray(image)) return false
  const reference = image as Record<string, unknown>
  return (
    reference.id === mediaId &&
    (reference.provider === undefined || reference.provider === 'local')
  )
}

function imageReferencesId(
  record: Record<string, unknown>,
  mediaId: string,
): boolean {
  if (record._type !== 'image') return false
  const asset = record.asset
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return false
  const reference = asset as Record<string, unknown>
  return reference._ref === mediaId || reference.id === mediaId
}

export function previewMediaUrl(value: string, token: string): string {
  const url = new URL(value, 'http://localhost')
  if (!url.pathname.startsWith(mediaPrefix)) return value
  url.searchParams.set('_preview', token)
  return `${url.pathname}${url.search}`
}
