import { defineConfig } from 'vitest/config'
import { vitestCoverageDefaults } from '../../scripts/testing/vitest-coverage.mjs'
import { sourceExclusions, sourcePatterns } from './scripts/quality-sources/index.mjs'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs', 'tests/runtime/**/*.test.ts'],
    coverage: {
      ...vitestCoverageDefaults,
      include: sourcePatterns,
      exclude: sourceExclusions,
      thresholds: {
        ...vitestCoverageDefaults.thresholds,
        branches: 75,
      },
    },
  },
})
