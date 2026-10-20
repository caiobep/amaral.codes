import assert from 'node:assert/strict'
import test from 'node:test'
import { readEditorMedia } from './media.mjs'
import { editorMedia } from './media-config.mjs'

const configuration = { access_key_id: 'a'.repeat(64), account_id: 'b'.repeat(32), bucket: 'amaral-publishing-media', public_url: 'https://preview.example.com/_media' }

test('R2 editor configuration accepts no secret and cannot grant access to the original asset bucket', () => {
  assert.equal(editorMedia(configuration).prefix, 'cms-uploads/')
  assert.throws(() => editorMedia({ ...configuration, secret_access_key: 'not-accepted' }))
  assert.throws(() => editorMedia({ ...configuration, bucket: 'original-assets' }))
  assert.throws(() => editorMedia({ ...configuration, public_url: 'http://preview.example.com/_media' }))
})

test('private media reads are scoped, read-only, non-cacheable and never expose bucket listings', async () => {
  const calls = []
  const bucket = { get: async key => { calls.push(key); return { body: 'photo', size: 5, httpEtag: 'etag', httpMetadata: { contentType: 'image/webp' } } } }
  const request = (key, method = 'GET') => new Request(`https://preview.example.com/_media/${key}`, { method })
  assert.equal((await readEditorMedia(request('other/file.webp'), bucket)).status, 404)
  assert.equal((await readEditorMedia(request('cms-uploads/file.webp', 'PUT'), bucket)).status, 405)
  assert.deepEqual(calls, [])
  const response = await readEditorMedia(request('cms-uploads/file.webp'), bucket)
  assert.equal(await response.text(), 'photo')
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(response.headers.get('Content-Type'), 'image/webp')
  assert.deepEqual(calls, ['cms-uploads/file.webp'])
})
