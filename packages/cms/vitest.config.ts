import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      include: [
        'src/access/**/*.ts',
        'src/entry-data/**/*.ts',
        'src/editor/**/*.ts',
        'src/preview/**/*.ts',
        'src/collections/**/*.ts',
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/payload-types.ts',
        'src/**/importMap.{ts,js}',
      ],
      reporter: ['text-summary', 'json'],
      thresholds: {
        branches: 80,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
})
