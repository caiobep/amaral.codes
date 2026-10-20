import type { APIContext, MiddlewareHandler } from 'astro'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { onRequest } from './middleware'

const state = vi.hoisted(() => ({ guard: vi.fn(), cacheSet: vi.fn() }))
vi.mock('astro:middleware', () => ({ defineMiddleware: (handler: MiddlewareHandler) => handler }))
vi.mock('./lib/cms/media/gate', () => ({ guardMediaRequest: state.guard }))

function requestContext(): APIContext {
  return { cache: { set: state.cacheSet } } as unknown as APIContext
}

beforeEach(() => {
  vi.stubEnv('AMARAL_CMS_TRIAL', '0')
  state.guard.mockReset()
  state.cacheSet.mockReset()
})

afterEach(() => vi.unstubAllEnvs())

it('preserves the default static response without invoking CMS runtime', async () => {
  const context = requestContext()
  const response = new Response('Static page')
  expect(await onRequest(context, () => Promise.resolve(response))).toBe(response)
  expect(state.guard).not.toHaveBeenCalled()
  expect(response.headers.has('X-Robots-Tag')).toBe(false)
})

it('sets trial privacy headers without consulting the unconfigured cache provider', async () => {
  vi.stubEnv('AMARAL_CMS_TRIAL', '1')
  state.guard.mockResolvedValue(new Response('Trial page', { headers: { 'Cache-Control': 'max-age=3600' } }))
  const context = requestContext()
  const response = await onRequest(context, () => Promise.resolve(new Response())) as Response
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store')
  expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
  expect(state.cacheSet).not.toHaveBeenCalled()
})
