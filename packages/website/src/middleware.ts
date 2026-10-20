import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (context, next) => {
  if (import.meta.env.AMARAL_CMS_TRIAL !== '1') return next()
  const { guardMediaRequest } = await import('./lib/cms/media/gate')
  const response = await guardMediaRequest(context, next)
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
})
