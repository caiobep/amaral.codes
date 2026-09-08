import { METRICS } from '../config.mjs'

export function summarize(routes, results) {
  return routes.map((route) => {
    const routeResults = results.filter((result) => result.route.path === route.path)
    const metrics = Object.fromEntries(
      METRICS.map(({ key }) => [key, summarizeMetric(routeResults, key)]),
    )
    return { label: route.label, path: route.path, metrics }
  })
}

function summarizeMetric(results, key) {
  const values = results.map(({ metrics }) => metrics[key]).filter((value) => value !== null)
  return values.length === 0 ? null : median(values)
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}
