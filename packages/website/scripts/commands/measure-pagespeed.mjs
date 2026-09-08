#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { REPORT_DIRECTORY } from '../performance/config.mjs'

const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
const FIELD_METRICS = [
  {
    id: 'LARGEST_CONTENTFUL_PAINT_MS',
    label: 'LCP',
    scale: 1,
    unit: 'ms',
  },
  {
    id: 'INTERACTION_TO_NEXT_PAINT',
    label: 'INP',
    scale: 1,
    unit: 'ms',
  },
  {
    id: 'CUMULATIVE_LAYOUT_SHIFT_SCORE',
    label: 'CLS',
    scale: 0.01,
    unit: '',
  },
]

function readOption(args, name, fallback) {
  const prefix = `--${name}=`
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function parseOptions(args) {
  const strategy = readOption(args, 'strategy', 'mobile')
  if (!['mobile', 'desktop'].includes(strategy)) {
    throw new Error('--strategy must be mobile or desktop.')
  }
  return {
    strategy,
    url: readOption(args, 'url', 'https://amaral.codes/'),
  }
}

function buildRequestUrl(options) {
  const requestUrl = new URL(ENDPOINT)
  requestUrl.searchParams.set('category', 'performance')
  requestUrl.searchParams.set('strategy', options.strategy)
  requestUrl.searchParams.set('url', options.url)
  if (process.env.PAGESPEED_API_KEY) {
    requestUrl.searchParams.set('key', process.env.PAGESPEED_API_KEY)
  }
  return requestUrl
}

async function requestPageSpeed(options) {
  const response = await fetch(buildRequestUrl(options))
  if (response.ok) return response.json()

  const hint = response.status === 429
    ? ' Set PAGESPEED_API_KEY or retry after the API quota resets.'
    : ''
  throw new Error(`PageSpeed request failed with HTTP ${response.status}.${hint}`)
}

function fieldRow(metrics, definition) {
  const metric = metrics?.[definition.id]
  return {
    Category: metric?.category ?? 'NO DATA',
    Metric: definition.label,
    p75: metric === undefined
      ? 'n/a'
      : `${metric.percentile * definition.scale}${definition.unit}`,
  }
}

function printFieldData(label, experience) {
  console.log(`\n${label}: ${experience?.id ?? 'no qualifying CrUX data'}`)
  console.table(FIELD_METRICS.map((definition) => fieldRow(experience?.metrics, definition)))
}

function readAudit(result, id) {
  return result.lighthouseResult?.audits?.[id]?.displayValue ?? 'n/a'
}

function printLabData(result) {
  const score = result.lighthouseResult?.categories?.performance?.score
  console.log('\nPageSpeed lab result:')
  console.table([{
    CLS: readAudit(result, 'cumulative-layout-shift'),
    FCP: readAudit(result, 'first-contentful-paint'),
    LCP: readAudit(result, 'largest-contentful-paint'),
    Score: typeof score === 'number' ? Math.round(score * 100) : 'n/a',
    TBT: readAudit(result, 'total-blocking-time'),
  }])
}

async function writeReport(options, result) {
  await fs.mkdir(REPORT_DIRECTORY, { recursive: true })
  const reportPath = path.join(REPORT_DIRECTORY, `pagespeed-${options.strategy}.json`)
  await fs.writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`)
  console.log(`Raw response: ${reportPath}`)
}

async function run(options) {
  console.log(`Measuring ${options.url} with the ${options.strategy} strategy...`)
  const result = await requestPageSpeed(options)
  printFieldData('Page field data', result.loadingExperience)
  printFieldData('Origin field data', result.originLoadingExperience)
  printLabData(result)
  await writeReport(options, result)
}

run(parseOptions(process.argv.slice(2))).catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
