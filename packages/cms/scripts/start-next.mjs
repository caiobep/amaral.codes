import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const args = ['dev', '--hostname', process.env.CMS_TRIAL_HOST ?? '127.0.0.1', '--port', '4010']
if (process.env.CMS_TRIAL_HOST) {
  args.push('--experimental-https', '--experimental-https-cert', process.env.CMS_TRIAL_CERT,
    '--experimental-https-key', process.env.CMS_TRIAL_KEY)
}
const child = spawn(process.execPath, [fileURLToPath(import.meta.resolve('next/dist/bin/next')), ...args], { stdio: 'inherit' })
child.on('exit', code => { process.exitCode = code ?? 1 })
