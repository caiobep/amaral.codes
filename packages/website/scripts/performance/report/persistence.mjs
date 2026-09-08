import fs from 'node:fs/promises'
import path from 'node:path'

export function writeSummary(reportDirectory, payload) {
  const reportPath = path.join(reportDirectory, 'summary.json')
  return fs.writeFile(reportPath, `${JSON.stringify(payload, null, 2)}\n`)
}
