import type { CollectionConfig } from 'payload'
import { privateAccess } from '../../access'
import { previewEntry } from '../../preview'
import { podcastFields, talkFields } from '../entry-media'

const previewOrigin = `${process.env.CMS_TRIAL_HOST ? 'https' : 'http'}://${process.env.CMS_TRIAL_HOST ?? '127.0.0.1'}:4324`

export const Entries: CollectionConfig = {
  slug: 'entries',
  labels: { singular: 'Note', plural: 'Notes' },
  access: privateAccess,
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', '_status', 'updatedAt'],
    preview: (doc) => `${previewOrigin}/cms-preview/${String(doc.id)}`,
    livePreview: {
      url: ({ data }) => data.id ? `${previewOrigin}/cms-preview/${String(data.id)}` : undefined,
      breakpoints: [
        { label: 'Phone', name: 'phone', width: 390, height: 844 },
        { label: 'Tablet', name: 'tablet', width: 768, height: 1024 },
        { label: 'Desktop', name: 'desktop', width: 1280, height: 900 },
      ],
    },
  },
  versions: { drafts: { autosave: { interval: 1000, showSaveDraftButton: true } }, maxPerDoc: 30 },
  endpoints: [{ path: '/:id/preview', method: 'get', handler: previewEntry }],
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, admin: { position: 'sidebar' } },
    { name: 'summary', type: 'textarea' },
    {
      name: 'category', type: 'select', required: true, defaultValue: 'note',
      options: ['note', 'essay', 'review', 'link', 'video', 'podcast', 'talk'],
      admin: { position: 'sidebar' },
    },
    { name: 'date', type: 'date', required: true, defaultValue: () => new Date().toISOString(), admin: { position: 'sidebar' } },
    { name: 'language', type: 'select', options: ['en', 'pt-BR'], defaultValue: 'en', admin: { position: 'sidebar' } },
    { name: 'topics', type: 'text', hasMany: true, admin: { position: 'sidebar' } },
    podcastFields,
    talkFields,
    { name: 'body', type: 'richText', required: true },
  ],
}
