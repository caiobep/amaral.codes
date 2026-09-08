import type { CollectionConfig } from 'payload'
import { privateAccess } from '../../access'
import { stateDirectory } from '../../trial-state'

export const Media: CollectionConfig = {
  slug: 'media',
  access: privateAccess,
  upload: {
    staticDir: `${stateDirectory}/uploads`,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf', 'audio/mpeg'],
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Cache-Control', 'private, no-store')
      headers.set('Vary', 'Cookie')
      return headers
    },
  },
  fields: [{ name: 'alt', label: 'Description / alt text', type: 'text', required: true }],
}
