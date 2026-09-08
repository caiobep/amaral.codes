import { METRICS } from '../config.mjs'

export function findBudgetFailures(summaries) {
  return findFailures(summaries, 'threshold')
}

export function findTargetMisses(summaries) {
  return findFailures(summaries, 'target')
}

function findFailures(summaries, limitKey) {
  return summaries.flatMap((summary) => METRICS
    .filter((metric) => !isPassing(summary.metrics[metric.key], metric, metric[limitKey]))
    .map((metric) => ({
      actual: summary.metrics[metric.key],
      limit: metric[limitKey],
      metric,
      route: summary.label,
    })))
}

function isPassing(value, metric, limit) {
  if (value === null) return false
  return metric.direction === 'min'
    ? value >= limit
    : value <= limit
}
