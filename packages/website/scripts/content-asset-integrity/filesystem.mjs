import fs from 'node:fs/promises'
import path from 'node:path'

export async function readMarkdownDocuments(directory, formatPath) {
  const filePaths = (await listFiles(directory))
    .filter(filePath => filePath.endsWith('.md'))
    .sort()
  return Promise.all(filePaths.map(async filePath => ({
    filePath: formatPath(filePath),
    source: await fs.readFile(filePath, 'utf8'),
  })))
}

export async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(target) : [target]
  }))
  return nested.flat()
}
