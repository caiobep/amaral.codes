import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { collectQualitySources, sourceExclusions, sourcePatterns } from './index.mjs'

it('measures executable sources independently of filename and test presence', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-sources-'))
  const files = [
    'src/lib/query/index.ts', 'src/lib/query/index.test.ts',
    'src/scripts/search.ts', 'src/scripts/layout/runtime.ts',
    'src/scripts/layout/index.ts', 'src/scripts/env.d.ts',
  ]
  try {
    for (const file of files) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      fs.writeFileSync(path.join(root, file), '')
    }
    const expected = files.filter(file => sourcePatterns.some(pattern => path.matchesGlob(file, pattern))
      && !sourceExclusions.some(pattern => path.matchesGlob(file, pattern)))
    expect(collectQualitySources(root)).toEqual(expected.sort())
    expect(collectQualitySources(root)).toContain('src/scripts/layout/runtime.ts')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
