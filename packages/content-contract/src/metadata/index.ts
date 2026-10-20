import { z } from 'zod'
import { sharingSchema, linkCardSchema } from './sharing.ts'
import {
  isPublicHttpsUrl,
  isRootRelativePublicUrl,
} from '../public-url/index.ts'

export const ENTRY_CATEGORIES = [
  'essay',
  'note',
  'review',
  'link',
  'video',
  'podcast',
  'talk',
] as const
export const ENTRY_LANGUAGES = ['en', 'pt-BR'] as const
export const PROJECT_KINDS = ['software', 'physical'] as const
export const PODCAST_PLAYERS = [
  'applePodcasts',
  'spotify',
  'pocketCasts',
  'overcast',
] as const
export const TALK_FORMATS = ['talk', 'workshop', 'brownbag'] as const
export const TALK_MATERIAL_TYPES = ['pdf', 'keynote', 'powerpoint'] as const

const meaningfulText = z.string()
  .trim()
  .min(1)
  .refine(value => value.toLowerCase() !== 'undefined', 'Use meaningful text.')
const optionalText = meaningfulText.optional()
const publicHttpsUrl = z.url().refine(isPublicHttpsUrl, 'Use a public HTTPS URL.')
const localUrl = z.string().trim().refine(
  isRootRelativePublicUrl,
  'Use a root-relative local URL.',
)
const localOrHttpUrl = z.union([
  localUrl,
  publicHttpsUrl,
])
const dateString = z.string().trim().min(1).refine(
  (value) => !Number.isNaN(Date.parse(value)),
  'Use an ISO date such as 2026-07-24.',
)

const podcastPlayersSchema = z.array(z.object({
  service: z.enum(PODCAST_PLAYERS),
  url: publicHttpsUrl,
}).strict()).min(1).refine(
  (players) => new Set(players.map(({ service }) => service)).size === players.length,
  'Use each podcast player once.',
)
const podcastAudioUrlSchema = z.union([
  publicHttpsUrl,
  localUrl.refine(value => value.startsWith('/podcasts/'), 'Use a hosted podcast URL.'),
])
const podcastSchema = z.object({
  show: z.string().trim().min(1),
  episode: optionalText,
  sourceUrl: publicHttpsUrl,
  players: podcastPlayersSchema,
  audioUrl: podcastAudioUrlSchema.optional(),
  audioBytes: z.number().int().positive().optional(),
}).strict().superRefine((podcast, context) => {
  if (Boolean(podcast.audioUrl) !== Boolean(podcast.audioBytes)) {
    context.addIssue({
      code: 'custom',
      path: ['audioBytes'],
      message: 'Hosted audio needs its URL and byte length for podcast RSS clients.',
    })
  }
})

const talkMaterialSchema = z.object({
  label: z.string().trim().min(1),
  type: z.enum(TALK_MATERIAL_TYPES),
  url: z.union([
    localUrl.refine(value => value.startsWith('/talks/'), 'Use a hosted talk material URL.'),
    publicHttpsUrl,
  ]),
  preview: z.object({
    src: localOrHttpUrl,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).strict().optional(),
}).strict()
const talkSchema = z.object({
  format: z.enum(TALK_FORMATS).default('talk'),
  event: optionalText,
  language: z.enum(['en', 'pt-BR']).optional(),
  materials: z.array(talkMaterialSchema).min(1),
}).strict()

const entryShape = {
  title: z.string().trim().min(1),
  date: dateString,
  language: z.enum(ENTRY_LANGUAGES).optional(),
  translation: z.object({
    key: z.string().regex(/^posts\/[a-zA-Z0-9_-]+$/u),
    primary: z.boolean(),
    href: z.string().regex(/^\/(?:en\/|pt-br\/)?posts\/[a-zA-Z0-9_-]+$/u),
  }).strict().optional(),
  summary: optionalText,
  topics: z.array(z.string().trim().min(1)).default([]),
  featuredOrder: z.number().int().positive().optional(),
  sharing: sharingSchema.optional(),
  linkCards: z.array(linkCardSchema).optional(),
}

export const entrySchema = z.union([
  z.object({
    ...entryShape,
    category: z.enum(['essay', 'note', 'review', 'link', 'video']).default('note'),
    podcast: z.never().optional(),
    talk: z.never().optional(),
  }).strict(),
  z.object({
    ...entryShape,
    category: z.literal('podcast'),
    podcast: podcastSchema,
    talk: z.never().optional(),
  }).strict(),
  z.object({
    ...entryShape,
    category: z.literal('talk'),
    podcast: z.never().optional(),
    talk: talkSchema,
  }).strict(),
])

const projectVisualSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('image'),
    src: localOrHttpUrl,
    alt: z.string().trim().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    sources: z.array(z.object({
      src: localOrHttpUrl,
      width: z.number().int().positive(),
    }).strict()).default([]),
  }).strict(),
  z.object({
    type: z.literal('code'),
    lines: z.array(z.string()).min(1),
  }).strict(),
])
export const projectSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  kind: z.enum(PROJECT_KINDS).default('software'),
  order: z.number().int().positive(),
  featuredOrder: z.number().int().positive().optional(),
  category: z.string().trim().min(1),
  technologies: z.array(z.string().trim().min(1)).default([]),
  externalUrl: publicHttpsUrl.optional(),
  externalLabel: z.string().trim().min(1).optional(),
  visual: projectVisualSchema.optional(),
}).strict().superRefine((project, context) => {
  if (project.featuredOrder === undefined) return

  if (!project.visual) {
    context.addIssue({
      code: 'custom',
      path: ['visual'],
      message: 'Featured projects need an image or code visual.',
    })
  }

})

export const publicContentMetadataSchema = z.union([entrySchema, projectSchema])

export type EntryCategory = (typeof ENTRY_CATEGORIES)[number]
export type EntryLanguage = (typeof ENTRY_LANGUAGES)[number]
export type ProjectKind = (typeof PROJECT_KINDS)[number]
export type EntryData = z.infer<typeof entrySchema>
export type PodcastData = NonNullable<EntryData['podcast']>
export type TalkData = NonNullable<EntryData['talk']>
export type ProjectData = z.infer<typeof projectSchema>
export type ProjectVisual = NonNullable<ProjectData['visual']>
export type PublicContentMetadata = z.infer<typeof publicContentMetadataSchema>

export function parsePublicContentMetadata(metadata: unknown): PublicContentMetadata {
  return publicContentMetadataSchema.parse(metadata)
}
