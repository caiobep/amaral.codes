/** @satisfies {NonNullable<import('vitest/config').TestUserConfig['coverage']>} */
export const vitestCoverageDefaults = {
  provider: 'v8',
  reporter: ['text-summary', 'json'],
  thresholds: {
    branches: 80,
    functions: 90,
    lines: 90,
    statements: 90,
  },
}
