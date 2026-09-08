import { describe, expect, it } from 'vitest'
import { METRICS } from '../config.mjs'
import {
  findBudgetFailures,
  findTargetMisses,
  summarize,
} from './index.mjs'

const ROUTE = { label: 'Test route', path: '/test/' }

function valuesFor(limitKey) {
  return Object.fromEntries(METRICS.map((metric) => [metric.key, metric[limitKey]]))
}

describe('performance report', () => {
  it('uses the median metric value across repeated runs', () => {
    const baseMetrics = valuesFor('target')
    const results = [1_000, 2_000, 3_000].map((largestContentfulPaint, index) => ({
      metrics: { ...baseMetrics, largestContentfulPaint },
      route: ROUTE,
      run: index + 1,
    }))

    const [summary] = summarize([ROUTE], results)

    expect(summary.metrics.largestContentfulPaint).toBe(2_000)
  })

  it('reports a target miss without failing the regression budget', () => {
    const summary = {
      label: ROUTE.label,
      metrics: {
        ...valuesFor('target'),
        largestContentfulPaint: 3_000,
      },
      path: ROUTE.path,
    }

    expect(findTargetMisses([summary])).toHaveLength(1)
    expect(findBudgetFailures([summary])).toHaveLength(0)
  })

  it('fails values beyond the regression ceiling', () => {
    const summary = {
      label: ROUTE.label,
      metrics: {
        ...valuesFor('target'),
        largestContentfulPaint: 4_001,
      },
      path: ROUTE.path,
    }

    expect(findBudgetFailures([summary])).toMatchObject([
      { route: ROUTE.label, actual: 4_001 },
    ])
  })
})
