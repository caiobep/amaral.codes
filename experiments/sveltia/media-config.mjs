import assert from 'node:assert/strict'

export function editorMedia(configuration) {
  assert.deepEqual(Object.keys(configuration).sort(), ['access_key_id', 'account_id', 'bucket', 'public_url'])
  assert(/^(?:[a-f0-9]{32}|[a-f0-9]{64})$/u.test(configuration.access_key_id), 'Use an R2 access key identifier')
  assert(/^[a-f0-9]{32}$/u.test(configuration.account_id), 'Use a Cloudflare account identifier')
  assert.equal(configuration.bucket, 'amaral-publishing-media', 'Editor credentials must use the dedicated media bucket')
  const url = new URL(configuration.public_url)
  assert.equal(url.protocol, 'https:')
  assert.equal(url.pathname, '/_media')
  assert(!url.username && !url.password && !url.search && !url.hash)
  return { ...configuration, prefix: 'cms-uploads/' }
}
