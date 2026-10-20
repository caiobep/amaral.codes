import { ContentRepository, RevisionRepository } from 'emdash'
import type { ContentItem, MediaItem } from 'emdash'
import { getDb } from 'emdash/runtime'
import { referencesMedia } from './keys'

export async function protectedPostReferences(
  media: Pick<MediaItem, 'id' | 'storageKey'>,
): Promise<boolean> {
  const db = await getDb()
  const content = new ContentRepository(db)
  const revisions = new RevisionRepository(db)
  for (const status of ['published', 'scheduled']) {
    let cursor: string | undefined
    do {
      const page = await content.findMany('posts', {
        where: { status },
        ...(cursor ? { cursor } : {}),
      })
      if (await pageReferences(page.items, media, revisions)) return true
      cursor = page.nextCursor
    } while (cursor)
  }
  return false
}

async function pageReferences(
  posts: ContentItem[],
  media: Pick<MediaItem, 'id' | 'storageKey'>,
  revisions: RevisionRepository,
): Promise<boolean> {
  for (const post of posts)
    if (await postReferences(post, media, revisions)) return true
  return false
}

async function postReferences(
  post: ContentItem,
  media: Pick<MediaItem, 'id' | 'storageKey'>,
  revisions: RevisionRepository,
): Promise<boolean> {
  if (
    post.status === 'published' &&
    referencesMedia(post.data, media.storageKey, media.id)
  )
    return true
  if (!post.scheduledAt) return false
  if (!post.draftRevisionId)
    return referencesMedia(post.data, media.storageKey, media.id)
  const revision = await revisions.findById(post.draftRevisionId)
  if (!revision) throw new Error('Scheduled post revision is missing')
  return referencesMedia(revision.data, media.storageKey, media.id)
}
