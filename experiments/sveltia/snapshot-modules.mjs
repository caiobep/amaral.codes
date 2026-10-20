import fs from 'node:fs/promises'
import path from 'node:path'

export async function copyPublishingModule(name, target) {
  const source = await fs.readFile(new URL(name, import.meta.url), 'utf8')
  const prepared = source
    .replaceAll('../../packages/content-contract/', './content-contract/')
    .replaceAll('../../scripts/', './')
    .replaceAll('./editor/sharing-artwork.mjs', './website/src/features/publishing/sharing-artwork.mjs')
  await fs.writeFile(path.join(target, name), prepared)
}
