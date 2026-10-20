import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMaterialsWorker } from './materials-worker.mjs'
import { prepareTalkMaterials } from './talk-materials.mjs'

const materialPath = '/talks/example/slides.pdf'
const key = 'talks/example/slides.pdf'
const worker = createMaterialsWorker({ [materialPath]: key })
const request = (pathname = materialPath, options) =>
  new Request(`https://preview.example${pathname}`, options)

test('build maps only canonical slide URLs and collects an exact serving allowlist', () => {
  const metadata = { talk: { materials: [
    { url: 'https://assets.amaral.codes/talks/example/slides.pdf' },
    { url: 'https://example.com/recording' },
  ] } }
  const materials = new Map()
  prepareTalkMaterials(metadata, materials)
  assert.equal(metadata.talk.materials[0].url, materialPath)
  assert.equal(metadata.talk.materials[1].url, 'https://example.com/recording')
  assert.deepEqual([...materials], [[materialPath, key]])
  for (const url of [
    'https://assets.amaral.codes/private/file.pdf',
    'https://assets.amaral.codes/talks/example/slides.pdf?token=private',
  ]) {
    assert.throws(() => prepareTalkMaterials({ talk: { materials: [{ url }] } }, new Map()))
  }
})

test('unknown objects and write methods cannot reach the bucket', async () => {
  for (const path of ['/talks/private.pdf', '/talks/__proto__']) {
    assert.equal((await worker.fetch(request(path), {})).status, 404)
  }
  for (const method of ['PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS']) {
    const response = await worker.fetch(request(materialPath, { method }), {})
    assert.equal(response.status, 405)
    assert.equal(response.headers.get('allow'), 'GET, HEAD')
  }
})

test('streams PDF bytes with private headers and forwards ranges to R2', async () => {
  const req = request(materialPath, { headers: { Range: 'bytes=4-7' } })
  const response = await worker.fetch(req, { TALK_MATERIALS: {
    async get(actualKey, options) {
      assert.equal(actualKey, key)
      assert.equal(options.range.get('range'), 'bytes=4-7')
      return { body: 'test', size: 100, range: { offset: 4, length: 4 }, httpEtag: '"version"' }
    },
  } })
  assert.equal(response.status, 206)
  assert.equal(response.headers.get('content-range'), 'bytes 4-7/100')
  assert.equal(response.headers.get('content-length'), '4')
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('etag'), '"version"')
  assert.equal(await response.text(), 'test')
})

test('full downloads, suffix reads, HEAD, and missing objects return correct responses', async () => {
  const object = { body: 'document', size: 8, httpEtag: '"version"' }
  const env = { TALK_MATERIALS: {
    async get() { return object },
    async head() { return object },
  } }
  const full = await worker.fetch(request(), env)
  assert.equal(full.status, 200)
  assert.equal(await full.text(), 'document')
  object.range = { suffix: 4 }
  const suffix = await worker.fetch(request(), env)
  assert.equal(suffix.headers.get('content-range'), 'bytes 4-7/8')
  delete object.range
  const head = await worker.fetch(request(materialPath, { method: 'HEAD' }), env)
  assert.equal(head.status, 200)
  assert.equal(head.headers.get('content-length'), '8')
  assert.equal(await head.text(), '')
  env.TALK_MATERIALS.get = async () => null
  assert.equal((await worker.fetch(request(), env)).status, 404)
})

test('ordinary site routes retain static asset handling', async () => {
  const response = await worker.fetch(request('/posts/'), {
    ASSETS: { fetch: async req => new Response(new URL(req.url).pathname) },
  })
  assert.equal(await response.text(), '/posts/')
})


test('unconfigured editor media is unavailable without attempting a bucket read', async () => {
  const worker = createMaterialsWorker({})
  const result = await worker.fetch(new Request('https://preview.example.com/_media/cms-uploads/example.webp'), {})
  assert.equal(result.status, 404)
})
