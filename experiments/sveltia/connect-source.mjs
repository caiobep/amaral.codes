import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { validateSourcePin } from './bootstrap.mjs'

export async function prepareSourceConnection(directory, revision, { versionUrlsProtected = false } = {}) {
  const pin = validateSourcePin({ repository: 'caiobep/amaral.codes', revision })
  await fs.mkdir(path.join(directory, 'publishing'), { recursive: true })
  await fs.copyFile(new URL('./bootstrap.mjs', import.meta.url), path.join(directory, 'publishing/bootstrap.mjs'))
  await fs.copyFile(new URL('./preview-status.mjs', import.meta.url), path.join(directory, 'publishing/preview-status.mjs'))
  await fs.mkdir(path.join(directory, '.github/workflows'), { recursive: true })
  await fs.copyFile(new URL('./preview-status-workflow.yml', import.meta.url), path.join(directory, '.github/workflows/publishing-preview.yml'))
  await fs.copyFile(new URL('./deploy.mjs', import.meta.url), path.join(directory, 'publishing/deploy.mjs'))
  await fs.writeFile(path.join(directory, 'publishing/security.json'), JSON.stringify({ versionUrlsProtected }, null, 2) + '\n')
  await fs.writeFile(path.join(directory, 'publishing/source.json'), JSON.stringify(pin, null, 2) + '\n')
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({
    name: 'amaral-publishing-content', private: true, type: 'module',
    engines: { node: '>=24.16.0' },
    scripts: { build: 'node publishing/bootstrap.mjs', deploy: 'node publishing/deploy.mjs' },
    devDependencies: { wrangler: '4.151.2' },
  }, null, 2) + '\n')
  await fs.writeFile(path.join(directory, '.gitignore'), '.publishing/\nnode_modules/\n.wrangler/\n.env*\n')
  return pin
}

export function connectionPlan(sourceFiles) {
  assert(sourceFiles.every(filename => filename.startsWith('.publishing/')), 'Only generated snapshot files may be retired')
  return { retire: sourceFiles, preserve: ['entries', 'media', 'taxonomy', 'link-previews', 'publishing'], source: 'caiobep/amaral.codes', policy: 'immutable reviewed revision' }
}
