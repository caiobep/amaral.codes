import { getCollection } from 'astro:content'
import { ContentRepository, MediaRepository, definePlugin } from 'emdash'
import type { ContentPolicyEvent } from 'emdash'
import { getDb } from 'emdash/runtime'
import { cmsOwnsEntries } from '../mode'
import { publicationProblem, type PublicPosition } from './policy'

export function createPlugin() {
  return definePlugin({
    id: 'amaral-publishing',
    version: '1.0.0',
    capabilities: ['content:read', 'hooks.content-policy:register'],
    hooks: {
      'content:beforePublish': validatePublication,
      'content:beforeSchedule': validatePublication,
    },
  })
}

export async function validatePublication(event: ContentPolicyEvent) {
  if (event.collection !== 'posts') return undefined
  const reason = await publicationProblem(event.content, {
    publicPositions,
    mediaKey: readyMediaKey,
    mediaReady: assertReadyMediaKey,
  })
  return reason ? { cancel: true as const, reason } : undefined
}

async function publicPositions(): Promise<PublicPosition[]> {
  const files = cmsOwnsEntries ? [] : await getCollection('entries')
  const positions: PublicPosition[] = files.map(entry => ({
    id: `file:${entry.id}`,
    slug: entry.id,
    featuredOrder: entry.data.featuredOrder,
  }))
  const repository = new ContentRepository(await getDb())
  let cursor: string | undefined
  do {
    const page = await repository.findMany('posts', {
      where: { status: 'published' },
      ...(cursor ? { cursor } : {}),
    })
    positions.push(...page.items.map(item => ({
      id: item.id,
      slug: item.slug,
      featuredOrder: item.data.featured_order,
    })))
    cursor = page.nextCursor
  } while (cursor)
  return positions
}

async function readyMediaKey(id: string): Promise<string> {
  const media = await new MediaRepository(await getDb()).findById(id)
  if (media?.status !== 'ready' || !media.storageKey)
    throw new Error('Choose an uploaded image that is ready before publishing.')
  return media.storageKey
}

async function assertReadyMediaKey(key: string): Promise<void> {
  const media = await (await getDb())
    .selectFrom('media')
    .select('id')
    .where('storage_key', '=', key)
    .where('status', '=', 'ready')
    .executeTakeFirst()
  if (!media)
    throw new Error('Choose an uploaded image that is ready before publishing.')
}
