import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { prepareLanTLS } from './lan-tls/index.mjs'

const cmsRoot = fileURLToPath(new URL('..', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const secretPath = new URL('../.local/secret', import.meta.url)
await mkdir(new URL('../.local', import.meta.url), { recursive: true })
if (process.env.CMS_TRIAL_TEST === '1') {
  const testState = new URL('../.local/test', import.meta.url)
  await rm(testState, { recursive: true, force: true })
  await mkdir(testState, { recursive: true })
}
try {
  await writeFile(secretPath, randomBytes(48).toString('hex'), { flag: 'wx', mode: 0o600 })
} catch (error) {
  if (error.code !== 'EEXIST') throw error
}
const env = { ...process.env, PAYLOAD_SECRET: await readFile(secretPath, 'utf8') }
if (env.CMS_TRIAL_HOST) {
  const { cert, key } = await prepareLanTLS(env.CMS_TRIAL_HOST, fileURLToPath(new URL('../.local/https', import.meta.url)))
  Object.assign(env, { CMS_TRIAL_CERT: cert, CMS_TRIAL_KEY: key, NODE_EXTRA_CA_CERTS: cert })
}

await generate()
const children = [
  spawn('npm', ['run', 'dev'], { cwd: cmsRoot, env, stdio: 'inherit', detached: true }),
  spawn('npm', ['run', 'dev:cms', '-w', '@amaral.codes/website'], { cwd: repoRoot, env, stdio: 'inherit', detached: true }),
]
let stopping = false
for (const child of children) child.on('exit', code => {
  if (!stopping) process.exitCode = code ?? 1
  stop()
})
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
console.log(`\nLocal CMS: ${env.CMS_TRIAL_HOST ? 'https' : 'http'}://${env.CMS_TRIAL_HOST ?? '127.0.0.1'}:4010/admin\nNotion remains the default. This trial cannot publish to production.\n`)

function stop() {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue
    process.kill(-child.pid, 'SIGTERM')
  }
}

function generate() {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'generate'], { cwd: cmsRoot, env, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error('Payload generation failed.')))
  })
}
