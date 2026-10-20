import type { CollectionEntry } from 'astro:content'
import type {
  ContentEntry,
  EntryResult,
  ImageValue,
  PortableTextBlock,
} from 'emdash'
import { z } from 'astro/zod'
import { hydrateCmsImages, serializeCmsBody } from './body'
import { publicCmsMetadata } from './metadata'
import { assertNativeContent } from './native-content'

type NativeEntry = ContentEntry
type PublicEntry = CollectionEntry<'entries'>
export interface CmsArticleResult extends EntryResult<Record<string, unknown>> {
  publicEntry: PublicEntry | undefined
  renderFields:
    | {
        databaseId: string
        content: PortableTextBlock[]
        featuredImage: ImageValue | undefined
      }
    | undefined
}

const cmsEntries = new WeakSet<PublicEntry>()

export async function getPublishedCmsEntries(): Promise<PublicEntry[]> {
  if (import.meta.env.AMARAL_CMS_TRIAL !== '1') return []
  const { getEmDashCollection, getRequestContext, runWithContext } =
    await import('emdash')
  const context = publicQueryContext(getRequestContext())
  // Native collection queries hydrate drafts in preview/edit mode even with a published filter.
  const result = await runWithContext(context, () =>
    getEmDashCollection<'posts', Record<string, unknown>>('posts', {
      status: 'published',
    }),
  )
  if (result.error) throw result.error
  return Promise.all(
    result.entries
      .filter(entry => entry.data.status === 'published')
      .map(mapHydratedEntry),
  )
}

export async function getCmsArticle(slug: string): Promise<CmsArticleResult> {
  if (import.meta.env.AMARAL_CMS_TRIAL !== '1')
    return {
      entry: null,
      isPreview: false,
      cacheHint: {},
      publicEntry: undefined,
      renderFields: undefined,
    }
  const { getEmDashEntry } = await import('emdash')
  const result = await getEmDashEntry<'posts', Record<string, unknown>>(
    'posts',
    slug,
  )
  const renderFields = result.entry
    ? await nativeRenderFields(result.entry.data)
    : undefined
  const publicEntry = result.entry
    ? await mapHydratedEntry(result.entry)
    : undefined
  return {
    ...result,
    publicEntry,
    renderFields,
  }
}

function publicQueryContext(
  context: import('emdash').EmDashRequestContext | undefined,
): import('emdash').EmDashRequestContext {
  const publicContext = { ...context, editMode: false }
  delete publicContext.preview
  return publicContext
}

async function mapHydratedEntry(entry: NativeEntry): Promise<PublicEntry> {
  await hydrateCmsImages(entry.data.content, resolveMediaKey)
  return mapCmsEntry(entry)
}

async function resolveMediaKey(id: string): Promise<string> {
  return (await resolveStoredMedia(id)).storageKey
}

async function resolveStoredMedia(id: string) {
  if (import.meta.env.AMARAL_CMS_TRIAL !== '1')
    throw new Error('Native media requires CMS trial mode')
  const { MediaRepository } = await import('emdash')
  const { getDb } = await import('emdash/runtime')
  const media = await new MediaRepository(await getDb()).findById(id)
  if (media?.status !== 'ready' || !media.storageKey)
    throw new Error('CMS image has no durable stored media')
  return media
}

async function nativeRenderFields(
  data: Record<string, unknown>,
): Promise<NonNullable<CmsArticleResult['renderFields']>> {
  const databaseId = z.string().min(1).parse(data.id)
  const content = data.content ?? []
  assertNativeContent(content)
  return {
    databaseId,
    content,
    featuredImage: await nativeFeaturedImage(data.featured_image),
  }
}

async function nativeFeaturedImage(
  value: unknown,
): Promise<ImageValue | undefined> {
  if (value == null) return undefined
  const image = z
    .object({ id: z.string().min(1), alt: z.string().optional() })
    .parse(value)
  const media = await resolveStoredMedia(image.id)
  return {
    id: image.id,
    provider: 'local',
    meta: { storageKey: media.storageKey, mimeType: media.mimeType },
    ...(media.width == null ? {} : { width: media.width }),
    ...(media.height == null ? {} : { height: media.height }),
    ...(image.alt === undefined ? {} : { alt: image.alt }),
  }
}

export function mapCmsEntry(
  entry: Pick<NativeEntry, 'id' | 'data'>,
): PublicEntry {
  if (entry.id === entry.data.id || !/^[a-z0-9][a-z0-9_-]*$/u.test(entry.id))
    throw new Error('CMS post needs a canonical public slug')
  const publicEntry: PublicEntry = {
    id: entry.id,
    collection: 'entries',
    data: publicCmsMetadata(entry.data),
    body: serializeCmsBody(entry.data.content),
  }
  cmsEntries.add(publicEntry)
  return publicEntry
}

export function isCmsEntry(entry: PublicEntry): boolean {
  return cmsEntries.has(entry)
}

export function mergePublicEntries(
  files: PublicEntry[],
  posts: PublicEntry[],
): PublicEntry[] {
  const merged = [...files, ...posts]
  const slugs = new Set<string>()
  const featured = new Set<number>()
  for (const entry of merged) assertUniqueEntry(entry, slugs, featured)
  return merged
}

function assertUniqueEntry(
  entry: PublicEntry,
  slugs: Set<string>,
  featured: Set<number>,
): void {
  if (slugs.has(entry.id))
    throw new Error(`Public entry slug collision: ${entry.id}`)
  slugs.add(entry.id)
  const order = entry.data.featuredOrder
  if (order === undefined) return
  if (featured.has(order))
    throw new Error(`Duplicate public featured order: ${String(order)}`)
  featured.add(order)
}
