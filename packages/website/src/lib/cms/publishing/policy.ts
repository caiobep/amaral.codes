import { z } from 'astro/zod'
import { hydrateCmsImages, serializeCmsBody } from '../body'
import { publicCmsMetadata } from '../metadata'
import { assertNativeContent } from '../native-content'
import { assertCmsMediaReady } from './media'

export interface PublicPosition {
  id: string
  slug: string | null
  featuredOrder: unknown
}

export interface PublicationChecks {
  publicPositions: () => Promise<PublicPosition[]>
  mediaKey: (id: string) => Promise<string>
  mediaReady: (key: string) => Promise<void>
}

const candidate = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/u, {
    error: 'Use a URL slug with lowercase letters, numbers, hyphens or underscores.',
  }),
  data: z.record(z.string(), z.unknown()),
  publishedAt: z.unknown().optional(),
  createdAt: z.unknown().optional(),
})

export async function publicationProblem(
  value: unknown,
  checks: PublicationChecks,
): Promise<string | undefined> {
  try {
    await assertPublishable(value, checks)
    return undefined
  } catch (error) {
    const reason = error instanceof z.ZodError
      ? z.prettifyError(error)
      : publicationError(error)
    return `Cannot publish: ${reason}`.slice(0, 500)
  }
}

function publicationError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Content could not be validated. Save it and try again.'
}

async function assertPublishable(value: unknown, checks: PublicationChecks): Promise<void> {
  const post = candidate.parse(value)
  if (post.id === post.slug)
    throw new Error('Set a public URL slug before publishing.')
  const metadata = publicCmsMetadata({
    ...post.data,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
  })
  const body: unknown = structuredClone(post.data.content ?? [])
  assertNativeContent(body)
  await hydrateCmsImages(body, checks.mediaKey, checks.mediaReady)
  serializeCmsBody(body)
  await assertCmsMediaReady(body, checks.mediaReady)
  await assertFeaturedImage(post.data.featured_image, checks.mediaKey)
  const positions = await checks.publicPositions()
  assertPublicPosition(post, metadata.featuredOrder, positions)
}

async function assertFeaturedImage(value: unknown, resolveKey: PublicationChecks['mediaKey']): Promise<void> {
  if (value == null) return
  const image = z.object({ id: z.string().min(1) }).parse(value)
  await resolveKey(image.id)
}

function assertPublicPosition(
  post: z.infer<typeof candidate>,
  order: number | undefined,
  positions: PublicPosition[],
): void {
  const others = positions.filter(position => position.id !== post.id)
  if (others.some(position => position.slug === post.slug))
    throw new Error('This URL slug is already used by a public post. Choose another slug.')
  if (order !== undefined && others.some(position => position.featuredOrder === order))
    throw new Error('This featured position is already used. Choose another number or leave it empty.')
}
