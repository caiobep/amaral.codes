import assert from 'node:assert/strict'
import test from 'node:test'
import { validateSourcePin } from './bootstrap.mjs'

test('the single website source must be the known repository at an immutable reviewed revision', () => {
  const pin = { repository: 'caiobep/amaral.codes', revision: 'a'.repeat(40) }
  assert.deepEqual(validateSourcePin(pin), pin)
  assert.throws(() => validateSourcePin({ ...pin, revision: 'main' }))
  assert.throws(() => validateSourcePin({ ...pin, revision: null }))
  assert.throws(() => validateSourcePin({ ...pin, repository: 'another/repository' }))
  assert.throws(() => validateSourcePin({ ...pin, token: 'must-not-exist' }))
})
