#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import {
  DESKTOP_REPORT_DIRECTORY,
  DEFAULT_ROUTES,
  DIST_DIRECTORY,
  METRICS,
  REPORT_DIRECTORY,
} from '../performance/config.mjs'
import { auditPage, launchChrome } from '../performance/lighthouse-runner.mjs'
import {
  findBudgetFailures,
  findTargetMisses,
  printBudgetFailures,
  printSummary,
  printTargetMisses,
  summarize,
  writeSummary,
} from '../performance/report/index.mjs'
import { startStaticServer } from '../performance/static-server.mjs'

function readOption(args, name) {
  const prefix = `--${name}=`
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

function readRoutes(args) {
  const paths = args
    .filter((argument) => argument.startsWith('--route='))
    .map((argument) => argument.slice('--route='.length))
  return paths.length === 0
    ? DEFAULT_ROUTES
    : paths.map((routePath) => ({ label: routePath, path: routePath }))
}

function parseRuns(value) {
  const runs = Number.parseInt(value ?? '1', 10)
  if (!Number.isInteger(runs) || runs < 1 || runs > 5) {
    throw new Error('--runs must be an integer from 1 through 5.')
  }
  return runs
}

function parsePreset(value) {
  const preset = value ?? 'mobile'
  if (preset !== 'mobile' && preset !== 'desktop') {
    throw new Error('--preset must be either mobile or desktop.')
  }
  return preset
}

function parseOptions(args) {
  const preset = parsePreset(readOption(args, 'preset'))
  return {
    assertBudgets: args.includes('--assert'),
    preset,
    reportDirectory: preset === 'desktop' ? DESKTOP_REPORT_DIRECTORY : REPORT_DIRECTORY,
    routes: readRoutes(args),
    runs: parseRuns(readOption(args, 'runs')),
  }
}

async function prepareReportDirectory(reportDirectory) {
  await fs.rm(reportDirectory, { force: true, recursive: true })
  await fs.mkdir(reportDirectory, { recursive: true })
}

async function assertBuildExists() {
  try {
    await fs.access(path.join(DIST_DIRECTORY, 'index.html'))
  } catch {
    throw new Error('No production build found. Run `npm run build` before `perf`.')
  }
}

async function collectAudits(options, server, chrome) {
  const results = []
  for (const route of options.routes) {
    for (let run = 1; run <= options.runs; run += 1) {
      console.log(`Auditing ${route.label} (${run}/${options.runs})...`)
      results.push(await auditPage({
        baseUrl: server.baseUrl,
        chromePort: chrome.port,
        preset: options.preset,
        reportDirectory: options.reportDirectory,
        route,
        run,
      }))
    }
  }
  return results
}

async function run(options) {
  await assertBuildExists()
  await prepareReportDirectory(options.reportDirectory)
  const server = await startStaticServer(DIST_DIRECTORY)
  let chrome

  try {
    chrome = await launchChrome()
    const results = await collectAudits(options, server, chrome)
    const summaries = summarize(options.routes, results)
    const failures = findBudgetFailures(summaries)
    const targetMisses = findTargetMisses(summaries)
    const payload = {
      generatedAt: new Date().toISOString(),
      lighthouseVersion: results[0]?.lighthouseVersion,
      metricDefinitions: METRICS,
      preset: options.preset,
      runs: options.runs,
      summaries,
    }

    printSummary(summaries)
    printTargetMisses(targetMisses)
    await writeSummary(options.reportDirectory, payload)
    if (options.assertBudgets) printBudgetFailures(failures)
    if (options.assertBudgets && failures.length > 0) process.exitCode = 1
  } finally {
    await Promise.allSettled([
      Promise.resolve(chrome?.kill()),
      server.close(),
    ])
  }
}

run(parseOptions(process.argv.slice(2))).catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
