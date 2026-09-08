import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  MAX_TALK_PREVIEW_BYTES,
  MAX_TRACKED_FILE_BYTES,
  findPresentationAssetViolations,
} from './index.mjs'

describe('findPresentationAssetViolations', () => {
  it('allows optimized local talk previews and the deployable resume', () => {
    const violations = findPresentationAssetViolations([
      file('packages/website/public/talks/example/preview.webp', 100_000),
      file('packages/website/public/resume/CV.pdf', 500_000, true),
    ])

    assert.deepEqual(violations, [])
  })

  it('rejects canonical presentations from deployable or tracked paths', () => {
    const violations = findPresentationAssetViolations([
      file('packages/website/public/talks/example/slides.pdf', 100_000),
      file('notes/example.key', 100_000, true),
    ])

    assert.deepEqual(violations.map(({ filePath }) => filePath), [
      'packages/website/public/talks/example/slides.pdf',
      'notes/example.key',
    ])
  })

  it('rejects oversized tracked files and deployable talk previews', () => {
    const violations = findPresentationAssetViolations([
      file('packages/website/public/talks/example/preview.webp', MAX_TALK_PREVIEW_BYTES + 1),
      file('packages/website/public/archive.bin', MAX_TRACKED_FILE_BYTES + 1, true),
    ])

    assert.equal(violations.length, 2)
    assert.match(violations[0].reason, /talk preview exceeds/u)
    assert.match(violations[1].reason, /tracked file exceeds/u)
  })

  it('rejects non-preview files from the deployable talk directory', () => {
    const violations = findPresentationAssetViolations([
      file('packages/website/public/talks/example/notes.txt', 100),
    ])

    assert.match(violations[0].reason, /optimized preview/u)
  })
})

function file(filePath, size, tracked = false) {
  return { filePath, size, tracked }
}
