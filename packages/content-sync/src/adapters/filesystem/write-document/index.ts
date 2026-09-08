import fs from 'node:fs/promises'
import path from 'node:path'

const SAFE_SLUG = /^[a-z0-9][a-z0-9_-]*$/

export async function writeContentSource(
  directory: string,
  slug: string,
  source: string,
): Promise<string> {
  if (!SAFE_SLUG.test(slug)) {
    throw new Error(`Invalid content slug: ${slug}`)
  }

  await fs.mkdir(directory, { recursive: true })
  const filePath = path.join(directory, `${slug}.md`)
  await fs.writeFile(filePath, source)
  return filePath
}
