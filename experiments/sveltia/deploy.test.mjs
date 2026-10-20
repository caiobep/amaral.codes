import assert from 'node:assert/strict'
import test from 'node:test'
import { deploymentArguments } from './deploy.mjs'

test('only published output activates traffic; draft output can only upload a version', () => {
  assert.equal(deploymentArguments({ kind: 'published' })[0], 'deploy')
  const arguments_ = deploymentArguments({ kind: 'draft', alias: 'draft-0123456789ab' })
  assert.deepEqual(arguments_.slice(0, 2), ['versions', 'upload'])
  assert(!arguments_.includes('deploy'))
  assert.throws(() => deploymentArguments({ kind: 'draft', alias: 'main' }))
  assert.throws(() => deploymentArguments({ kind: 'unknown' }))
})
