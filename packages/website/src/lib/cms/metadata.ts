import { z } from 'astro/zod'
import { entrySchema } from '../../content/schemas'

const topicTerms = z.array(z.object({
  slug: z.string().trim().min(1),
  label: z.string().trim().min(1).optional(),
}))

export function publicCmsMetadata(data: Record<string, unknown>) {
  return entrySchema.parse({
    title: data.title,
    date: publicDate(publicationDate(data)),
    category: data.category,
    language: optionalMetadata(data.language),
    summary: optionalMetadata(data.excerpt),
    topics: publicTopics(data),
    featuredOrder: data.featured_order ?? undefined,
    podcast: data.podcast ?? undefined,
    talk: data.talk ?? undefined,
  })
}

function publicationDate(data: Record<string, unknown>): unknown {
  return optionalMetadata(data.date) ?? data.publishedAt ?? data.createdAt
}

function publicDate(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value
}

function optionalMetadata(value: unknown): unknown {
  return value === '' || value === null ? undefined : value
}

function publicTopics(data: Record<string, unknown>): unknown {
  if (data.terms === undefined) return data.topics ?? undefined
  const terms = z.record(z.string(), z.unknown()).parse(data.terms)
  return topicTerms.parse(terms.topics ?? []).map(term => term.label ?? term.slug)
}
