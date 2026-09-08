#!/usr/bin/env node

import fs from 'node:fs'

const reportPath = process.argv[2]
const maxCrap = 6

if (!reportPath) throw new Error('Usage: assert-crap-report <report-path>')
if (!fs.existsSync(reportPath)) {
  throw new Error(`CRAP report not found at ${reportPath}.`)
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
const missingCoverage = report.methods.filter(({ crap }) => crap === null)
const excessiveRisk = report.methods.filter(({ crap }) => (
  crap !== null && crap > maxCrap
))

if (missingCoverage.length > 0 || excessiveRisk.length > 0) {
  const failures = [...missingCoverage, ...excessiveRisk]
  console.error(`Every analyzed function must have coverage data and CRAP <= ${String(maxCrap)}:`)
  failures.forEach(({ method, src, lineStart, crap, cc, cov }) => {
    const score = crap === null ? 'N/A' : crap.toFixed(2)
    const coverage = cov === null ? 'N/A' : `${cov.toFixed(1)}%`
    console.error(`  ${src}:${String(lineStart)} ${method} CRAP=${score} CC=${String(cc)} coverage=${coverage}`)
  })
  process.exitCode = 1
} else {
  const highest = Math.max(...report.methods.map(({ crap }) => crap ?? 0))
  console.log(
    `CRAP gate passed: ${String(report.methods.length)} functions analyzed, highest ${highest.toFixed(2)}.`,
  )
}
