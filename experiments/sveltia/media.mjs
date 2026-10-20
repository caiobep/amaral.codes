export async function readEditorMedia(request, bucket) {
  const pathname = new URL(request.url).pathname
  const key = pathname.slice('/_media/'.length)
  if (!/^cms-uploads\/[a-z0-9][a-z0-9._/-]*$/iu.test(key) || key.split('/').includes('..')) {
    return new Response('Not found', { status: 404 })
  }
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
  const object = request.method === 'HEAD' ? await bucket.head(key) : await bucket.get(key)
  if (!object) return new Response('Not found', { status: 404 })
  const headers = new Headers({
    'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
    'Content-Length': String(object.size), ETag: object.httpEtag,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow', 'Content-Security-Policy': "default-src 'none'; sandbox",
  })
  return new Response(request.method === 'HEAD' ? null : object.body, { headers })
}
