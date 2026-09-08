import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

export function getOutputPath(distDirectory, url) {
  const pathname = new URL(url, 'https://amaral.codes').pathname
  if (pathname === '/') return path.join(distDirectory, 'index.html')
  if (path.extname(pathname)) return path.join(distDirectory, pathname)
  return path.join(distDirectory, pathname, 'index.html')
}

export async function getBuildId(urls, distDirectory, generatedFiles = []) {
  const hash = createHash('sha256')
  const files = new Set([
    ...urls.map(url => getOutputPath(distDirectory, url)),
    ...generatedFiles,
  ])
  const sortedFiles = [...files].sort()
  const contents = await Promise.all(sortedFiles.map(file => fs.readFile(file)))

  contents.forEach((content, index) => {
    hash.update(path.relative(distDirectory, sortedFiles[index]))
    hash.update('\0')
    hash.update(content)
    hash.update('\0')
  })
  return hash.digest('hex').slice(0, 12)
}

export function injectManifest(template, urls, buildId) {
  return template
    .replace('BUILD_ID_PLACEHOLDER', buildId)
    .replace(
      '/* PRECACHE_URLS_PLACEHOLDER */',
      urls.map(url => JSON.stringify(url)).join(', '),
    )
}
