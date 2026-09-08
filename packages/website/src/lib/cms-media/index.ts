import { CMS_ORIGIN, PREVIEW_HEADERS } from '../cms-preview'

export async function fetchPreviewMedia(request: Request, filename: string, fetcher = fetch) {
  if (!filename || /^(\.|\.\.)$|[\\/]/.test(filename)) {
    return new Response(null, { status: 400, headers: PREVIEW_HEADERS })
  }
  const headers = copyHeaders(request.headers, ['cookie', 'range', 'origin', 'sec-fetch-site'])
  const response = await fetcher(`${CMS_ORIGIN}/api/media/file/${encodeURIComponent(filename)}`, {
    method: request.method, headers, cache: 'no-store', redirect: 'error',
  })
  const outgoing = new Headers(PREVIEW_HEADERS)
  copyHeaders(response.headers, ['content-type', 'content-length', 'content-range', 'accept-ranges'], outgoing)
  outgoing.set('X-Content-Type-Options', 'nosniff')
  return new Response(response.body, { status: response.status, headers: outgoing })
}

function copyHeaders(source: Headers, names: string[], target = new Headers()) {
  for (const name of names) {
    const value = source.get(name)
    if (value !== null) target.set(name, value)
  }
  return target
}
