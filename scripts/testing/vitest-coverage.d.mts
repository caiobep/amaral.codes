import type { TestUserConfig } from 'vitest/config'

type CoverageOptions = NonNullable<TestUserConfig['coverage']>

export declare const vitestCoverageDefaults: CoverageOptions & {
  thresholds: {
    branches: number
    functions: number
    lines: number
    statements: number
  }
}
