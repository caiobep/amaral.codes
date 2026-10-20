import { sanitizeCmsHtml } from './body-html'
import { mediaKeyFromUrl, mediaPrefix } from './media/keys'
import { isPublishableUrl } from './body-url'

export function renderCmsHtml(
  html: string,
  resolveMediaUrl: (key: string) => string,
): string {
  return sanitizeCmsHtml(html, url => {
    return renderCmsMediaUrl(url, resolveMediaUrl)
  })
}

export function renderCmsMediaUrl(
  url: string,
  resolveMediaUrl: (key: string) => string,
): string {
  if (!isPublishableUrl(url))
    throw new Error('CMS media URL must be public and durable')
  const key = mediaKeyFromUrl(url)
  return key && url === `${mediaPrefix}${key}` ? resolveMediaUrl(key) : url
}
