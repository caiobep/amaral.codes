import type { CollectionConfig } from 'payload'
import { privateAccess } from '../../access'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: { cookies: { secure: Boolean(process.env.CMS_TRIAL_HOST) } },
  access: { ...privateAccess, unlock: () => false },
  fields: [],
}
