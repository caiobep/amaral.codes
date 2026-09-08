import fs from 'node:fs/promises'
import path from 'node:path'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import { METRICS } from './config.mjs'

function chromeFlags() {
  const flags = ['--headless', '--disable-gpu']
  if (process.env.CI === 'true') flags.push('--no-sandbox')
  return flags
}

export function launchChrome() {
  return chromeLauncher.launch({ chromeFlags: chromeFlags(), logLevel: 'silent' })
}

function readMetric(lhr, metric) {
  if (metric.source === 'category') {
    const score = lhr.categories[metric.id]?.score
    return typeof score === 'number' ? score * 100 : null
  }

  const value = lhr.audits[metric.id]?.numericValue
  return typeof value === 'number' ? value : null
}

function extractMetrics(lhr) {
  return Object.fromEntries(METRICS.map((metric) => [metric.key, readMetric(lhr, metric)]))
}

function reportFileName(route, run) {
  const routeName = route.label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')
  return `${routeName}-run-${run}.html`
}

export async function auditPage({ baseUrl, chromePort, preset, reportDirectory, route, run }) {
  const url = new URL(route.path, baseUrl).href
  const result = await lighthouse(url, {
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    output: 'html',
    port: chromePort,
  }, preset === 'desktop' ? desktopConfig : undefined)

  if (result === undefined) throw new Error(`Lighthouse returned no result for ${url}.`)

  const reportPath = path.join(reportDirectory, reportFileName(route, run))
  await fs.writeFile(reportPath, result.report)

  return {
    lighthouseVersion: result.lhr.lighthouseVersion,
    metrics: extractMetrics(result.lhr),
    reportPath,
    route,
    run,
  }
}
