import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { X509Certificate } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { prepareLanTLS } from './index.mjs'

describe('LAN development TLS', () => {
  it.each(['0.0.0.0/path', 'example.com', '../outside'])('rejects invalid bind addresses: %s', async host => {
    await expect(prepareLanTLS(host, '/unused')).rejects.toThrow('IPv4')
  })

  it('creates a private certificate for the exact IP and reuses it across restarts', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cms-lan-tls-'))
    try {
      const directory = path.join(root, 'https')
      const files = await prepareLanTLS('192.0.2.10', directory)
      const pem = await readFile(files.cert, 'utf8')
      const certificate = new X509Certificate(pem)
      expect(certificate.checkIP('192.0.2.10')).toBe('192.0.2.10')
      expect(certificate.checkIP('192.0.2.11')).toBeUndefined()
      expect((await stat(directory)).mode & 0o777).toBe(0o700)
      expect(await prepareLanTLS('192.0.2.10', directory)).toEqual(files)
      expect(await readFile(files.cert, 'utf8')).toBe(pem)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
