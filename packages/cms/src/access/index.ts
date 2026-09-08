import type { Access } from 'payload'

export const authenticated: Access = ({ req }) => Boolean(req.user)

export const privateAccess = {
  create: authenticated,
  read: authenticated,
  update: authenticated,
  delete: authenticated,
}
