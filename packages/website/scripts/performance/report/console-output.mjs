import { METRICS } from '../config.mjs'

export function printSummary(summaries) {
  console.table(summaries.map(tableRow))
}

export function printBudgetFailures(failures) {
  if (failures.length === 0) return console.log('Performance regression budgets passed.')
  printFailures(failures, 'Performance regression budgets failed:', console.error)
}

export function printTargetMisses(failures) {
  if (failures.length === 0) return console.log('Performance targets met.')
  printFailures(failures, 'Performance targets not yet met:', console.warn)
}

function tableRow(summary) {
  return Object.fromEntries([
    ['Route', summary.label],
    ...METRICS.map((metric) => [
      metric.label,
      formatMetric(summary.metrics[metric.key], metric.format),
    ]),
  ])
}

function printFailures(failures, heading, logger) {
  logger(heading)
  failures.forEach(({ actual, limit, metric, route }) => {
    const comparison = metric.direction === 'min' ? '>=' : '<='
    const actualValue = formatMetric(actual, metric.format)
    const expected = formatMetric(limit, metric.format)
    logger(`  ${route}: ${metric.label} ${actualValue}, expected ${comparison} ${expected}`)
  })
}

function formatMetric(value, format) {
  if (value === null) return 'n/a'
  if (format === 'bytes') return `${Math.round(value / 1_024)} KiB`
  if (format === 'decimal') return value.toFixed(3)
  if (format === 'milliseconds') return `${Math.round(value)} ms`
  return Math.round(value).toString()
}
