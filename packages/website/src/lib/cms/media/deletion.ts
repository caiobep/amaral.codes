import type { APIContext } from 'astro'
import type {} from 'emdash/internal/middleware/auth'
import { canActOnOwn, hasPermission, hasScope } from '@emdash-cms/auth'
import { MediaRepository } from 'emdash'
import { getDb } from 'emdash/runtime'
import {
  mediaDeletionConflict,
  requestedMediaDeletion,
  type MediaDeletionRequest,
} from './deletion-requests'
import { protectedPostReferences } from './deletion-references'

export async function mediaDeletionResponse(
  context: APIContext,
): Promise<Response | null> {
  const request = await requestedMediaDeletion(context)
  if (!request || !canRequestDeletion(context, request)) return null
  const media = await new MediaRepository(await getDb()).findById(
    request.mediaId,
  )
  if (!media) return null
  if (!canDeleteMedia(context, request, media.authorId)) return null
  if (!(await protectedPostReferences(media))) return null
  return mediaDeletionConflict(request)
}

function canDeleteMedia(
  context: APIContext,
  request: MediaDeletionRequest,
  ownerId: string | null,
): boolean {
  return (
    request.provider ||
    canActOnOwn(
      context.locals.user,
      ownerId ?? '',
      'media:delete_own',
      'media:delete_any',
    )
  )
}

function canRequestDeletion(
  context: APIContext,
  request: MediaDeletionRequest,
): boolean {
  const permission = request.provider ? 'media:delete_any' : 'media:delete_own'
  if (!hasPermission(context.locals.user, permission)) return false
  const scopes = context.locals.tokenScopes
  return !scopes || hasScope(scopes, 'media:write')
}
