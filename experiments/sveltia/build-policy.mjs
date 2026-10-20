import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export function publishingTarget(branch, kind = 'published') {
  if (kind === 'published') {
    assert(!branch || branch === 'main', 'Draft branches must not deploy to the published preview')
    return { kind, alias: undefined, previewUrls: false }
  }
  assert.equal(kind, 'draft', 'Unknown publishing build kind')
  assert(/^cms\/[a-z0-9_/-]+$/iu.test(branch ?? ''), 'Only CMS workflow branches may build draft previews')
  const alias = `draft-${createHash('sha256').update(branch).digest('hex').slice(0, 12)}`
  return { kind, alias, previewUrls: true }
}
