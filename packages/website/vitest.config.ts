import { defineConfig } from 'vitest/config'
import { sourceExclusions, sourcePatterns } from './scripts/quality-sources/index.mjs'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs', 'tests/runtime/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: sourcePatterns,
      exclude: sourceExclusions,
      reporter: ['text-summary', 'json'],
      thresholds: {
        branches: 75,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
})
