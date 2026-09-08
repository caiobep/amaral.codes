import process from 'node:process'
import { runCli } from './cli/index.ts'
import { formatCliError } from './cli/error-report/index.ts'

runCli(process.argv.slice(2)).catch((error: unknown) => {
  console.error(formatCliError(error))
  process.exitCode = 1
})
