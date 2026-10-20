import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'

export function previewStatus(check, requests) {
  if (check.app?.id !== 85455 || check.name !== 'Workers Builds: amaral-publishing-preview' || check.status !== 'completed') return undefined
  const request = requests.find(item => item.state === 'open' && item.head?.repo?.full_name === 'caiobep/amaral-content' && item.head.sha === check.head_sha && /^cms\/[a-z0-9_/-]+$/iu.test(item.head.ref))
  if (!request) return undefined
  const success = check.conclusion === 'success'
  const alias = `draft-${createHash('sha256').update(request.head.ref).digest('hex').slice(0, 12)}`
  return {
    context: 'publishing-preview', state: success ? 'success' : 'failure',
    description: success ? 'Protected draft preview is ready' : 'Draft preview build did not succeed',
    ...(success ? { target_url: `https://${alias}-amaral-publishing-preview.caiobep.workers.dev` } : {}),
  }
}

export async function reportPreview(event, token, send = fetch) {
  const check = event.check_run
  if (event.repository?.full_name !== 'caiobep/amaral-content' || !/^[a-f0-9]{40}$/u.test(check?.head_sha ?? '')) return
  if (check.app?.id !== 85455 || check.name !== 'Workers Builds: amaral-publishing-preview') return
  const base = 'https://api.github.com/repos/caiobep/amaral-content'
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  const related = await send(`${base}/commits/${check.head_sha}/pulls?per_page=100`, { headers })
  if (!related.ok) throw Error('Cannot read associated draft requests')
  const status = previewStatus(check, await related.json())
  if (!status) return
  const result = await send(`${base}/statuses/${check.head_sha}`, { method: 'POST', headers, body: JSON.stringify(status) })
  if (!result.ok) throw Error('Cannot report protected draft preview')
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const event = JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8'))
  await reportPreview(event, process.env.GITHUB_TOKEN)
}
