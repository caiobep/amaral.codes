import type { PortableTextBlock } from 'emdash'
import { usesEmbedHtml } from '../body-embed'
import { cmsHtmlMediaUrls } from '../body-html'
import { isNativeMediaUrl, mediaKeyFromUrl } from '../media/keys'

export async function assertCmsMediaReady(
  blocks: PortableTextBlock[],
  ready: (key: string) => Promise<void>,
): Promise<void> {
  const urls = blocks.flatMap(renderedMediaUrls)
  for (const url of urls) {
    if (!isNativeMediaUrl(url)) continue
    const key = mediaKeyFromUrl(url)
    if (!key)
      throw new Error(
        'Choose an uploaded file with a valid media URL before publishing.',
      )
    await ready(key)
  }
}

function renderedMediaUrls(block: PortableTextBlock): string[] {
  if (block._type === 'htmlBlock') return htmlMediaUrls(block.html)
  if (block._type === 'embed') return embedMediaUrls(block)
  if (block._type === 'file') return directMediaUrl(block.url)
  if (block._type === 'iframe') return directMediaUrl(block.src)
  return []
}

function embedMediaUrls(block: PortableTextBlock): string[] {
  const urls = directMediaUrl(block.url)
  if (typeof block.url === 'string' && usesEmbedHtml(block.url, block.provider))
    urls.push(...htmlMediaUrls(block.html))
  return urls
}

function htmlMediaUrls(value: unknown): string[] {
  return typeof value === 'string' ? cmsHtmlMediaUrls(value) : []
}

function directMediaUrl(value: unknown): string[] {
  return typeof value === 'string' ? [value] : []
}
