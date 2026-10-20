import { z } from 'astro/zod'
import { mediaKeyFromUrl, mediaPrefix, normalizeMediaKey } from './media/keys'
import { escapeMarkdown, markdownDestination, publicUrl } from './body-url'
import { protectBlockMarkup } from './body-text'

const imageAsset = z.object({
  url: z.string().optional(),
  src: z.string().optional(),
  _ref: z.string().optional(),
  id: z.string().optional(),
  meta: z.object({ storageKey: z.string().optional() }).optional(),
})
const image = z.object({
  _type: z.literal('image'),
  alt: z.string().default(''),
  caption: z.string().optional(),
  title: z.string().optional(),
  asset: imageAsset,
  link: z.object({ href: publicUrl, blank: z.boolean().optional() }).optional(),
})
export const imageBlock = image.transform(block => ({
  _type: block._type,
  markdown: imageMarkdown(block),
}))
export const galleryBlock = z
  .object({ _type: z.literal('gallery'), images: z.array(image).min(1) })
  .transform(block => ({
    _type: block._type,
    markdown: block.images.map(imageMarkdown).join('\n\n'),
  }))
type ImageAsset = z.infer<typeof imageAsset>
type Image = z.infer<typeof image>

function nativeImageUrl(asset: ImageAsset): string {
  const url = imageSource(asset)
  if (url) return publicUrl.parse(url)
  const key = asset.meta?.storageKey
  if (!key || normalizeMediaKey(key) !== key)
    throw new Error('CMS image needs a durable native media reference')
  return `${mediaPrefix}${key}`
}

function imageMarkdown(block: Image): string {
  const source = `![${escapeMarkdown(block.alt)}](${markdownDestination(nativeImageUrl(block.asset))})`
  const linked = block.link
    ? `[${source}](${markdownDestination(block.link.href)})`
    : source
  const caption = block.caption ?? block.title
  return caption
    ? `${linked}\n\n${protectBlockMarkup(escapeMarkdown(caption))}`
    : linked
}

export async function hydrateCmsImages(
  value: unknown,
  resolveKey: (id: string) => Promise<string>,
  validateReadyKey?: (key: string) => Promise<void>,
): Promise<void> {
  if (!Array.isArray(value)) return
  await Promise.all(
    value.map(block => hydrateMediaBlock(block, resolveKey, validateReadyKey)),
  )
}

async function hydrateMediaBlock(
  value: unknown,
  resolveKey: (id: string) => Promise<string>,
  validateReadyKey: ((key: string) => Promise<void>) | undefined,
): Promise<void> {
  if (!isRecord(value)) return
  if (value._type === 'gallery')
    return hydrateCmsImages(value.images, resolveKey, validateReadyKey)
  if (value._type !== 'image') return
  const asset = imageAsset.parse(value.asset)
  if (!hasDirectMedia(asset)) {
    const key = await resolveKey(nativeMediaReference(asset))
    const nativeAsset = z.record(z.string(), z.unknown()).parse(value.asset)
    asset.meta = { ...asset.meta, storageKey: key }
    value.asset = { ...nativeAsset, meta: asset.meta }
  }
  await validateImageKey(asset, validateReadyKey)
}

async function validateImageKey(
  asset: ImageAsset,
  validateReadyKey: ((key: string) => Promise<void>) | undefined,
): Promise<void> {
  if (!validateReadyKey) return
  const source = nativeImageUrl(asset)
  const key = mediaKeyFromUrl(source)
  if (key && source.startsWith(mediaPrefix)) await validateReadyKey(key)
}

function nativeMediaReference(asset: ImageAsset): string {
  const reference = asset._ref ?? asset.id
  if (!reference)
    throw new Error('CMS image needs a durable native media reference')
  return reference
}

function hasDirectMedia(asset: ImageAsset): boolean {
  return Boolean(imageSource(asset) ?? asset.meta?.storageKey)
}

function imageSource(asset: ImageAsset): string | undefined {
  return [asset.url, asset.src].find(value => Boolean(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
