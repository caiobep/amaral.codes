import fs from 'node:fs'
import path from 'node:path'

const sourceRoots = ['src/lib', 'src/scripts', 'src/features']
export const sourcePatterns = sourceRoots.map(root => `${root}/**/*.ts`)
export const sourceExclusions = ['**/*.test.ts', '**/*.d.ts']

export function collectQualitySources(root = '.') {
  return sourceRoots.flatMap(directory => walk(root, directory)).sort()
}

function walk(root, directory) {
  if (!fs.existsSync(path.join(root, directory))) return []
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const relativePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(root, relativePath)
    if (!entry.isFile() || !entry.name.endsWith('.ts')) return []
    if (sourceExclusions.some(pattern => path.matchesGlob(relativePath, pattern))) return []
    return [relativePath]
  })
}
