import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isGlobalAddress, pinnedLookup, publicResourceUrl, readPublicResource } from './public-fetch.mjs'

test('outbound admission rejects local, reserved, mapped, credentialed, and signed destinations', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '100.100.100.200', '169.254.169.254', '192.168.1.1', '198.18.0.1', '0.0.0.0', '255.255.255.255', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1']) assert.equal(isGlobalAddress(address), false, address)
  for (const address of ['1.1.1.1', '8.8.8.8', '2606:4700::1111']) assert.equal(isGlobalAddress(address), true, address)
  for (const url of ['http://example.com', 'https://localhost', 'https://host.local/', 'https://127.0.0.1/', 'https://user:password@example.com', 'https://example.com/?token=secret', 'https://example.com:8080/']) assert.throws(() => publicResourceUrl(url), url)
})

test('DNS admission pins resolved public addresses and rejects mixed public/private answers', async () => {
  const resolve = async () => [{ address: '1.1.1.1', family: 4 }]
  await new Promise((done, reject) => pinnedLookup('example.com', {}, (error, address, family) => {
    if (error) { reject(error); return }
    assert.equal(address, '1.1.1.1'); assert.equal(family, 4); done()
  }, resolve))
  await new Promise(done => pinnedLookup('example.com', { all: true }, error => {
    assert(error); done()
  }, async () => [...await resolve(), { address: '127.0.0.1', family: 4 }]))
})

test('redirects are revalidated and share one overall timeout signal', async () => {
  const signals = []
  const result = await readPublicResource('https://example.com/old', {}, async (url, options) => {
    signals.push(options.signal)
    return url.pathname === '/old' ? { redirect: '/new' } : { body: Buffer.from('ok'), type: 'text/html' }
  })
  assert.equal(result.url, 'https://example.com/new')
  assert.equal(signals[0], signals[1])
  let requests = 0
  await assert.rejects(readPublicResource('https://example.com', {}, async () => { requests++; return { redirect: 'https://127.0.0.1/private' } }))
  assert.equal(requests, 1)
  await assert.rejects(readPublicResource('https://example.com', {}, async () => ({ redirect: '/loop' })), /Too many/)
})
