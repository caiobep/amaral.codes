import assert from 'node:assert/strict'
import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'
import type { User } from '../../payload-types'
import { Users } from './index'

const author: User = {
  id: 1,
  collection: 'users',
  email: 'author@example.com',
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
}

function request(user: PayloadRequest['user'] = null): PayloadRequest {
  return { user } as PayloadRequest
}

describe('private users', () => {
  it('enables Payload authentication without adding public profile fields', () => {
    expect(Users.slug).toBe('users')
    expect(Users.auth).toEqual({ cookies: { secure: false } })
    expect(Users.fields).toEqual([])
  })

  it.each(['create', 'read', 'update', 'delete'] as const)(
    'requires authentication for user %s',
    async (operation) => {
      const access = Users.access?.[operation]
      assert(access)

      expect(await access({ req: request() })).toBe(false)
      expect(await access({ req: request(author) })).toBe(true)
    },
  )

  it.each([
    { name: 'anonymous', user: null },
    { name: 'authenticated', user: author },
  ])('disables manual unlock for $name callers', async ({ user }) => {
    const unlock = Users.access?.unlock
    assert(unlock)

    expect(await unlock({ req: request(user) })).toBe(false)
  })
})
