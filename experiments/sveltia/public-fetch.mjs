import assert from 'node:assert/strict'
import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { BlockList, isIP } from 'node:net'
import { isPublicHttpsUrl } from '../../packages/content-contract/src/public-url/index.ts'

const denied = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
  ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) denied.addSubnet(address, prefix, 'ipv4')
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]]) {
  denied.addSubnet(address, prefix, 'ipv6')
}
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')

export function isGlobalAddress(address) {
  const family = isIP(address)
  if (family === 4) return !denied.check(address, 'ipv4')
  return family === 6 && globalV6.check(address, 'ipv6') && !denied.check(address, 'ipv6')
}

export function publicResourceUrl(value) {
  assert(isPublicHttpsUrl(value), 'Resource URL must be public HTTPS without credentials')
  const url = new URL(value)
  assert(!url.port || url.port === '443', 'Only HTTPS port 443 is allowed')
  const host = url.hostname.replace(/^\[|\]$/gu, '')
  assert(host.includes('.') && !/\.(?:localhost|local|internal|invalid|test)$/iu.test(host), 'Local hosts are not allowed')
  assert(!isIP(host) || isGlobalAddress(host), 'Non-public addresses are not allowed')
  return url
}

export async function pinnedLookup(hostname, options, callback, resolve = lookup) {
  try {
    const addresses = await resolve(hostname, { all: true, verbatim: true })
    assert(addresses.length && addresses.every(item => isGlobalAddress(item.address)), 'DNS resolved to a non-public address')
    if (options.all) callback(null, addresses)
    else callback(null, addresses[0].address, addresses[0].family)
  } catch (error) { callback(error) }
}

function readResponse(response, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    response.on('data', chunk => {
      size += chunk.length
      if (size > maxBytes) response.destroy(new Error('Resource exceeds byte limit'))
      else chunks.push(chunk)
    })
    response.on('error', reject)
    response.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

async function requestResource(url, { accept, maxBytes, signal }) {
  return new Promise((resolve, reject) => {
    const outgoing = request(url, {
      method: 'GET', signal, maxHeaderSize: 16 * 1024,
      lookup: pinnedLookup,
      headers: { Accept: accept, 'Accept-Encoding': 'identity', 'User-Agent': 'Amaral-Link-Preview/1.0' },
    }, async response => {
      try {
        if (response.statusCode >= 300 && response.statusCode < 400) {
          response.resume()
          resolve({ redirect: response.headers.location })
          return
        }
        assert(response.statusCode === 200, `Resource returned HTTP ${response.statusCode}`)
        assert(!response.headers['content-encoding'] || response.headers['content-encoding'] === 'identity', 'Compressed resources are not accepted')
        const body = await readResponse(response, maxBytes)
        resolve({ body, type: response.headers['content-type'] ?? '' })
      } catch (error) { response.destroy(); reject(error) }
    })
    outgoing.on('error', reject)
    outgoing.end()
  })
}

export async function readPublicResource(value, options, transport = requestResource) {
  let url = publicResourceUrl(value)
  const boundedOptions = { ...options, signal: AbortSignal.timeout(5000) }
  for (let redirects = 0; redirects <= 3; redirects++) {
    const result = await transport(url, boundedOptions)
    if (!result.redirect) return { ...result, url: url.href }
    url = publicResourceUrl(new URL(result.redirect, url).href)
  }
  throw new Error('Too many resource redirects')
}
