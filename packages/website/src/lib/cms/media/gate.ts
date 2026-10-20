import type { APIContext } from 'astro'
import {
  editorCanReadMedia,
  previewPostReferences,
  publishedPostReferences,
  requestPreviewToken,
} from './access'
import { isMediaRequest, requestMediaKey } from './keys'
import { mediaDeletionResponse } from './deletion'

export async function guardMediaRequest(
  context: APIContext,
  next: () => Promise<Response>,
): Promise<Response> {
  const deletionResponse = await mediaDeletionResponse(context)
  if (deletionResponse) return deletionResponse
  if (!isMediaRequest(context.url)) return next()
  context.cache.set(false)
  const key = requestMediaKey(context.url)
  if (!key) return deniedMedia()
  if (!(await canReadMedia(context, key))) return deniedMedia()
  const response = await next()
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store')
  return response
}

async function canReadMedia(
  context: APIContext,
  key: string,
): Promise<boolean> {
  if (await editorCanReadMedia(context)) return true
  if (await publishedPostReferences(key)) return true
  return previewPostReferences(requestPreviewToken(context), key)
}

function deniedMedia(): Response {
  return new Response('File not found', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
