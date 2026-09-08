import { mkdir, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { isIPv4 } from 'node:net'
import path from 'node:path'

export async function prepareLanTLS(host, directory) {
  if (!isIPv4(host)) throw new Error('CMS_TRIAL_HOST must be this Mac\'s LAN IPv4 address.')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const cert = path.join(directory, `${host}.crt`)
  const key = path.join(directory, `${host}.key`)
  try {
    await access(cert)
    await access(key)
  } catch {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '365',
      '-subj', `/CN=${host}`, '-addext', `subjectAltName=IP:${host}`,
      '-keyout', key, '-out', cert,
    ], { stdio: 'ignore' })
  }
  return { cert, key }
}
