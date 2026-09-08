import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const env = { ...process.env, PAYLOAD_SECRET: randomBytes(48).toString('hex') }
for (const command of ['generate:importmap', 'generate:types']) {
  const result = spawnSync('payload', [command], { env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
