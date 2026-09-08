import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import type { PayloadHandler, PayloadRequest } from 'payload'
import { ZodError } from 'zod'
import { toEntryData, toRecordingUrl, type EntryInput } from '../entry-data'
import type { Entry } from '../payload-types'

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  Vary: 'Cookie',
}

export const previewEntry: PayloadHandler = async (req) => {
  if (!req.user) return Response.json({ error: 'Sign in to preview.' }, { status: 401, headers: privateHeaders })
  const draft = req.query.revision !== 'published'
  const entry = await findPreviewEntry(req, draft)
  if (!draft && entry._status !== 'published') {
    return Response.json({ error: 'This note has not been published.' }, { status: 404, headers: privateHeaders })
  }
  return renderPreview(entry, draft ? 'draft' : 'published')
}

function findPreviewEntry(req: PayloadRequest, draft: boolean) {
  const id = req.routeParams?.id
  if (typeof id !== 'string' && typeof id !== 'number') throw new Error('Missing preview ID.')
  return req.payload.findByID({ collection: 'entries', id, draft, depth: 2, overrideAccess: false, req })
}

function renderPreview(entry: Partial<Entry>, revision: 'draft' | 'published') {
  if (!entry.slug?.trim()) return incompletePreview()
  if (!entry.body) return incompletePreview()
  try {
    return Response.json({
      id: entry.slug,
      data: toEntryData(entry),
      html: recordingLink(entry) + convertLexicalToHTML({ data: entry.body }),
      revision,
    }, { headers: privateHeaders })
  } catch (error) {
    if (error instanceof ZodError) return incompletePreview()
    throw error
  }
}

function recordingLink(entry: EntryInput) {
  const url = toRecordingUrl(entry)
  if (!url) return ''
  const href = url.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  return `<p><a href="${href}">Watch the recording</a></p>`
}

function incompletePreview() {
  return Response.json({ error: 'Finish this draft to preview.' }, { status: 422, headers: privateHeaders })
}
