import { TALK_MATERIAL_TYPES } from '@amaral.codes/content-contract'
import { isPublicHttpsUrl } from '@amaral.codes/content-contract/public-url'
import { z } from 'zod'

const optionalText = z.string().nullish().transform(value => value === '' ? undefined : value ?? undefined)
const uploadSchema = z.object({
  filename: z.string().min(1).refine(value => !/[\\/]/.test(value)),
  mimeType: z.string(),
  filesize: z.number().int().positive(),
})
const podcastInput = z.object({
  show: z.string(), episode: optionalText, sourceUrl: z.string(),
  players: z.array(z.object({ service: z.string(), url: z.string() })),
  audio: z.unknown().optional(),
})
const materialInput = z.discriminatedUnion('source', [
  z.object({ source: z.literal('upload'), label: z.string(), file: z.unknown() }),
  z.object({ source: z.literal('url'), label: z.string(), type: z.enum(TALK_MATERIAL_TYPES), url: z.string() }),
])
const talkInput = z.object({
  format: optionalText, event: optionalText, language: optionalText,
  materials: z.array(materialInput),
})

// The local Astro preview must proxy these paths to authenticated Payload media.
export function uploadedMediaUrl(value: unknown, kind: 'podcasts' | 'talks') {
  const mimeType = kind === 'podcasts' ? 'audio/mpeg' : 'application/pdf'
  const media = uploadSchema.extend({ mimeType: z.literal(mimeType) }).parse(value)
  return { url: `/${kind}/cms-preview/${encodeURIComponent(media.filename)}`, bytes: media.filesize }
}

export function podcastData(value: unknown) {
  const input = podcastInput.parse(value)
  const { show, episode, sourceUrl, players } = input
  if (input.audio == null) return { show, episode, sourceUrl, players }
  const audio = uploadedMediaUrl(input.audio, 'podcasts')
  return { show, episode, sourceUrl, players, audioUrl: audio.url, audioBytes: audio.bytes }
}

function materialData(material: z.infer<typeof materialInput>) {
  if (material.source === 'url') {
    return { label: material.label, type: material.type, url: material.url }
  }
  return { label: material.label, type: 'pdf', url: uploadedMediaUrl(material.file, 'talks').url }
}

export function talkData(value: unknown) {
  const { format, event, language, materials } = talkInput.parse(value)
  return { format, event, language, materials: materials.map(materialData) }
}

export function recordingUrl(value: unknown): string | undefined {
  const input = z.object({ recordingUrl: optionalText }).parse(value)
  return z.string().refine(isPublicHttpsUrl, 'Use a public HTTPS URL.').optional().parse(input.recordingUrl)
}
