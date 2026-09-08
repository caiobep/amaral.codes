import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createSlug } from './index.ts'

test('creates stable ASCII slugs', () => {
  assert.equal(
    createSlug('Configuração, cafés & APIs'),
    'configuracao-cafes-apis',
  )
})

test('rejects titles without usable characters', () => {
  assert.throws(() => createSlug('???'), /Could not create a slug/)
})
