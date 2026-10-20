import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import yaml from 'js-yaml'
import { publishingTarget } from './build-policy.mjs'
import { previewStatus, reportPreview } from './preview-status.mjs'

const check = { app: { id: 85455 }, name: 'Workers Builds: amaral-publishing-preview', status: 'completed', conclusion: 'success', head_sha: 'a'.repeat(40) }
const request = { state: 'open', head: { repo: { full_name: 'caiobep/amaral-content' }, sha: check.head_sha, ref: 'cms/posts/example' } }

test('only the completed first-party build and matching private draft can report the hashed preview', () => {
  const status = previewStatus(check, [request])
  assert.equal(status.target_url, `https://${publishingTarget(request.head.ref, 'draft').alias}-amaral-publishing-preview.caiobep.workers.dev`)
  assert(!status.target_url.includes('example'))
  assert.equal(previewStatus({ ...check, conclusion: 'failure' }, [request]).state, 'failure')
  assert.equal(previewStatus({ ...check, app: { id: 1 } }, [request]), undefined)
  assert.equal(previewStatus({ ...check, status: 'in_progress' }, [request]), undefined)
  for (const head of [{ ...request.head, sha: 'b'.repeat(40) }, { ...request.head, ref: 'main' }, { ...request.head, repo: { full_name: 'fork/content' } }]) {
    assert.equal(previewStatus(check, [{ ...request, head }]), undefined)
  }
})

test('the reporter uses an ephemeral repository token and sends no draft body or branch name', async () => {
  const calls = []
  const send = async (url, options) => {
    calls.push({ url, options })
    return calls.length === 1 ? Response.json([request]) : new Response(null, { status: 201 })
  }
  await reportPreview({ repository: { full_name: 'caiobep/amaral-content' }, check_run: check }, 'synthetic-test-token', send)
  assert.equal(calls.length, 2)
  assert.equal(JSON.parse(calls[1].options.body).context, 'publishing-preview')
  assert(!calls[1].options.body.includes(request.head.ref))
  await reportPreview({ repository: { full_name: 'fork/content' }, check_run: check }, 'synthetic-test-token', send)
  assert.equal(calls.length, 2)
})


test('the installed GitHub workflow parses and listens for the completed Cloudflare check', async () => {
  const workflow = yaml.load(await fs.readFile(new URL('./preview-status-workflow.yml', import.meta.url), 'utf8'))
  assert.deepEqual(workflow.on.check_run.types, ['completed'])
  assert(workflow.jobs.report.if.includes("'Workers Builds: amaral-publishing-preview'"))
  assert.deepEqual(workflow.permissions, { contents: 'read', 'pull-requests': 'read', statuses: 'write' })
})
