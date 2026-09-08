import type { APIRoute } from 'astro'
import { fetchPreviewMedia } from '../lib/cms-media'

export const GET: APIRoute = ({ request, params }) => fetchPreviewMedia(request, params.filename ?? '')
export const HEAD = GET
