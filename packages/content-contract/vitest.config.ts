import { defineConfig } from 'vitest/config'
import { vitestCoverageDefaults } from '../../scripts/testing/vitest-coverage.mjs'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      ...vitestCoverageDefaults,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
})
