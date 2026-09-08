import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'
import type { User } from '../payload-types'
import { authenticated, privateAccess } from './index'

const author: User = {
  id: 1,
  collection: 'users',
  email: 'author@example.com',
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
}

function request(user?: PayloadRequest['user']): PayloadRequest {
  return {
    user,
    headers: new Headers({ Cookie: 'amaral-cms-trial-token=unverified' }),
  } as PayloadRequest
}

describe('authenticated', () => {
  it.each([null, undefined])('denies an unverified cookie when req.user is %s', async (user) => {
    expect(await authenticated({ req: request(user) })).toBe(false)
  })

  it('allows a resolved Payload user', async () => {
    expect(await authenticated({ req: request(author) })).toBe(true)
  })
})

describe('privateAccess', () => {
  it.each(['create', 'read', 'update', 'delete'] as const)(
    'requires a resolved user for %s',
    async (operation) => {
      expect(await privateAccess[operation]({ req: request(null) })).toBe(false)
      expect(await privateAccess[operation]({ req: request() })).toBe(false)
      expect(await privateAccess[operation]({ req: request(author) })).toBe(true)
    },
  )
})
