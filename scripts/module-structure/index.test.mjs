import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  countTopLevelFunctions,
  findModuleStructureViolations,
} from './index.mjs'

describe('module structure', () => {
  it('counts declared and assigned top-level functions', () => {
    const source = [
      'function declared() {}',
      'const assigned = () => {}',
      'export default async () => {}',
    ].join('\n')

    assert.equal(countTopLevelFunctions('example.ts', source), 3)
  })

  it('ignores callbacks and nested functions', () => {
    const source = [
      'const values = [1].map(value => value)',
      'function outer() { function nested() {} return nested }',
    ].join('\n')

    assert.equal(countTopLevelFunctions('example.mjs', source), 1)
  })

  it('reports modules that exceed the configured responsibility limit', () => {
    const source = Array.from(
      { length: 3 },
      (_, index) => `function task${String(index)}() {}`,
    ).join('\n')

    assert.deepEqual(findModuleStructureViolations([
      { filePath: 'crowded.ts', source },
    ], 2), [{
      filePath: 'crowded.ts',
      functionCount: 3,
      maximumFunctions: 2,
    }])
  })
})
