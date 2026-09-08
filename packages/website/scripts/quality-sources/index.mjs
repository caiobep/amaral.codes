import fs from 'node:fs'
import path from 'node:path'

export const sourcePatterns = ['src/lib/**/*.ts', 'src/scripts/**/*.ts']
export const sourceExclusions = ['**/*.test.ts', '**/*.d.ts']

export function collectQualitySources(root = '.') {
  return ['src/lib', 'src/scripts'].flatMap(directory => walk(root, directory)).sort()
}

function walk(root, directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const relativePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(root, relativePath)
    if (!entry.isFile() || !entry.name.endsWith('.ts')) return []
    if (sourceExclusions.some(pattern => path.matchesGlob(relativePath, pattern))) return []
    return [relativePath]
  })
}
