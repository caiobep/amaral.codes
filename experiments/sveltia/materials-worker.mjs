import { readEditorMedia } from './media.mjs'

const contentTypes = {
  pdf: 'application/pdf',
  key: 'application/vnd.apple.keynote',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export function createMaterialsWorker(materials) {
  return {
    async fetch(request, env) {
      const pathname = new URL(request.url).pathname
      if (pathname.startsWith('/_media/')) return env.EDITOR_MEDIA
        ? readEditorMedia(request, env.EDITOR_MEDIA)
        : new Response('Not found', { status: 404 })
      if (!pathname.startsWith('/talks/')) {
        return env.ASSETS.fetch(request)
      }
      if (!Object.hasOwn(materials, pathname)) {
        return new Response('Not found', { status: 404 })
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        return new Response('Method not allowed', {
          status: 405,
          headers: { Allow: 'GET, HEAD' },
        })
      }
      return readMaterial(request, env.TALK_MATERIALS, materials[pathname])
    },
  }
}

async function readMaterial(request, bucket, key) {
  const object = request.method === 'HEAD'
    ? await bucket.head(key)
    : await bucket.get(key, { range: request.headers })
  if (!object) return new Response('Not found', { status: 404 })
  const headers = new Headers({
    'Content-Type': contentTypes[key.split('.').at(-1)],
    'Content-Length': String(object.size),
    'Accept-Ranges': 'bytes',
    ETag: object.httpEtag,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'same-origin',
  })
  if (object.range) setRangeHeaders(headers, object)
  return new Response(request.method === 'HEAD' ? null : object.body, {
    status: object.range ? 206 : 200,
    headers,
  })
}

function setRangeHeaders(headers, object) {
  const offset = object.range.offset ?? object.size - object.range.suffix
  const length = object.range.length ?? object.size - offset
  headers.set('Content-Length', String(length))
  headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`)
}
