import type { APIContext } from 'astro'
import { z } from 'astro/zod'

const deletionCall = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.literal('tools/call'),
  params: z.object({
    name: z.literal('media_delete'),
    arguments: z.object({ id: z.string() }),
  }),
})

export interface MediaDeletionRequest {
  mediaId: string
  provider: boolean
  rpcId?: string | number
}

export async function requestedMediaDeletion(
  context: APIContext,
): Promise<MediaDeletionRequest | null> {
  if (context.request.method === 'DELETE') return httpMediaDeletion(context.url)
  if (context.request.method !== 'POST') return null
  if (!/^\/_emdash\/api\/mcp\/?$/u.test(decodeURI(context.url.pathname)))
    return null
  const input: unknown = await context.request
    .clone()
    .json()
    .catch(() => null)
  const call = deletionCall.safeParse(input)
  return call.success
    ? {
        mediaId: call.data.params.arguments.id,
        provider: false,
        rpcId: call.data.id,
      }
    : null
}

function httpMediaDeletion(url: URL): MediaDeletionRequest | null {
  const match =
    /^\/_emdash\/api\/media\/(?:(providers\/local)\/)?([^/]+)\/?$/u.exec(
      decodeURI(url.pathname),
    )
  return match?.[2] ? { mediaId: match[2], provider: Boolean(match[1]) } : null
}

export function mediaDeletionConflict(request: MediaDeletionRequest): Response {
  const code = 'MEDIA_IN_USE'
  const message =
    'This media is used by a published or scheduled post. Remove or replace the reference and publish the change, or unpublish/unschedule the post, before deleting it.'
  if (request.rpcId !== undefined)
    return Response.json({
      jsonrpc: '2.0',
      id: request.rpcId,
      result: {
        content: [{ type: 'text', text: `[${code}] ${message}` }],
        isError: true,
        _meta: { code },
      },
    })
  return Response.json(
    { success: false, error: { code, message } },
    { status: 409 },
  )
}
