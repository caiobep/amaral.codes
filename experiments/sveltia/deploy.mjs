import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

export function deploymentArguments(target) {
  assert(['published', 'draft'].includes(target.kind), 'Unknown deployment target')
  const configuration = ['--config', '.publishing/output/wrangler.json']
  if (target.kind === 'published') return ['deploy', ...configuration]
  assert(/^draft-[a-f0-9]{12}$/u.test(target.alias), 'Invalid private preview alias')
  return ['versions', 'upload', ...configuration, '--preview-alias', target.alias]
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const target = JSON.parse(await fs.readFile('.publishing/output/target.json', 'utf8'))
  const executable = path.resolve('node_modules/wrangler/bin/wrangler.js')
  execFileSync(process.execPath, [executable, ...deploymentArguments(target)], { stdio: 'inherit' })
}
