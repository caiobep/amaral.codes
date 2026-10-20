import assert from 'node:assert/strict'
import test from 'node:test'
import { publishingTarget } from './build-policy.mjs'
import { deploymentArguments } from './deploy.mjs'

test('draft builds are explicit, restricted to CMS branches, and upload without activating traffic', () => {
  assert.throws(() => publishingTarget('cms/posts/private'))
  assert.throws(() => publishingTarget('main', 'draft'))
  assert.throws(() => publishingTarget('pull/1', 'draft'))
  const target = publishingTarget('cms/posts/private', 'draft')
  assert.match(target.alias, /^draft-[a-f0-9]{12}$/u)
  assert.deepEqual(deploymentArguments(target).slice(0, 2), ['versions', 'upload'])
  assert(!deploymentArguments(target).includes('deploy'))
})

test('draft URL aliases are stable without exposing entry titles or branch names', () => {
  assert.equal(publishingTarget('cms/posts/private', 'draft').alias, publishingTarget('cms/posts/private', 'draft').alias)
  assert.notEqual(publishingTarget('cms/posts/private', 'draft').alias, publishingTarget('cms/posts/other', 'draft').alias)
  assert.equal(publishingTarget('main').previewUrls, false)
})
