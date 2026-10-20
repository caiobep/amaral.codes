import { describe, expect, expectTypeOf, it } from 'vitest'
import type { EntryData, PodcastData, TalkData } from './index.ts'
import {
  entrySchema,
  parsePublicContentMetadata,
  projectSchema,
} from './index.ts'

const entry = {
  title: 'What I noticed',
  date: '2026-07-24',
  summary: 'What changed after I tried it.',
} as const

describe('entrySchema', () => {
  it('requires public metadata and applies stable defaults', () => {
    const result = entrySchema.parse(entry)

    expect(result.category).toBe('note')
    expect(result.topics).toEqual([])
  })

  it('rejects private, legacy, and invalid date metadata', () => {
    expect(entrySchema.safeParse({ ...entry, status: 'published' }).success).toBe(false)
    expect(entrySchema.safeParse({ ...entry, id: 'private-id' }).success).toBe(false)
    expect(entrySchema.safeParse({ ...entry, date: 'eventually' }).success).toBe(false)
    expect(entrySchema.safeParse({ ...entry, language: 'pt' }).success).toBe(false)
  })

  it('accepts an explicit document language', () => {
    expect(entrySchema.parse({ ...entry, language: 'pt-BR' }).language).toBe('pt-BR')
  })

  it('allows older public entries without an editorial summary', () => {
    const result = entrySchema.parse({
      date: entry.date,
      title: entry.title,
    })

    expect(result.summary).toBeUndefined()
  })

  it('rejects legacy placeholder text', () => {
    const result = entrySchema.safeParse({
      ...entry,
      summary: 'undefined',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Use meaningful text.')
  })

  it('accepts complete featured entries', () => {
    expect(entrySchema.parse({
      ...entry,
      featuredOrder: 1,
    }).featuredOrder).toBe(1)
  })
})

describe('podcast metadata', () => {
  const podcast = {
    show: 'A show',
    sourceUrl: 'https://example.com/episode',
    players: [{ service: 'spotify', url: 'https://example.com/spotify' }],
  } as const

  it('requires podcast metadata only on podcast entries', () => {
    expect(entrySchema.safeParse({
      ...entry,
      category: 'podcast',
    }).success).toBe(false)
    expect(entrySchema.safeParse({
      ...entry,
      podcast,
    }).success).toBe(false)
  })

  it('accepts complete playback metadata', () => {
    const result = entrySchema.parse({
      ...entry,
      category: 'podcast',
      podcast: {
        ...podcast,
        audioUrl: '/podcasts/episode.mp3',
        audioBytes: 1234,
      },
    })

    expect(result.podcast?.audioBytes).toBe(1234)
  })

  it('rejects duplicate players, invalid URLs, and partial hosted audio', () => {
    expect(entrySchema.safeParse({
      ...entry,
      category: 'podcast',
      podcast: {
        ...podcast,
        players: [podcast.players[0], podcast.players[0]],
      },
    }).success).toBe(false)
    expect(entrySchema.safeParse({
      ...entry,
      category: 'podcast',
      podcast: { ...podcast, sourceUrl: 'ftp://example.com/episode' },
    }).success).toBe(false)
    expect(entrySchema.safeParse({
      ...entry,
      category: 'podcast',
      podcast: { ...podcast, sourceUrl: 'http://example.com/episode' },
    }).success).toBe(false)
    expect(entrySchema.safeParse({
      ...entry,
      category: 'podcast',
      podcast: { ...podcast, sourceUrl: 'https://user:secret@example.com/episode' },
    }).success).toBe(false)
    expect(entrySchema.safeParse({
      ...entry,
      category: 'podcast',
      podcast: { ...podcast, sourceUrl: 'https://example.com/episode?token=secret' },
    }).success).toBe(false)
    expect(entrySchema.safeParse({
      ...entry,
      category: 'podcast',
      podcast: {
        ...podcast,
        sourceUrl: 'https://embed.example.com/?url=https%253A%252F%252Fexample.com'
          + '%252Fepisode%253Ftoken%253Dsecret',
      },
    }).success).toBe(false)
    expect(entrySchema.safeParse({
      ...entry,
      category: 'podcast',
      podcast: { ...podcast, audioBytes: 1234 },
    }).success).toBe(false)
  })
})

describe('talk metadata', () => {
  const talk = {
    materials: [{
      label: 'Open slides',
      type: 'pdf',
      url: '/talks/example/slides.pdf',
    }],
  } as const

  it('requires talk metadata only on talk entries', () => {
    expect(entrySchema.safeParse({ ...entry, category: 'talk' }).success).toBe(false)
    expect(entrySchema.safeParse({ ...entry, talk }).success).toBe(false)
  })

  it('accepts local and remote materials with previews', () => {
    const local = entrySchema.parse({ ...entry, category: 'talk', talk })
    const remote = entrySchema.parse({
      ...entry,
      category: 'talk',
      talk: {
        format: 'workshop',
        materials: [{
          ...talk.materials[0],
          url: 'https://assets.example.com/slides.pdf',
          preview: { src: '/talks/example/preview.webp', width: 800, height: 450 },
        }],
      },
    })

    expect(local.talk?.format).toBe('talk')
    expect(remote.talk?.materials[0]?.preview?.width).toBe(800)
  })

  it('rejects invalid material URLs', () => {
    const result = entrySchema.safeParse({
      ...entry,
      category: 'talk',
      talk: {
        materials: [{ ...talk.materials[0], url: 'ftp://example.com/slides.pdf' }],
      },
    })

    expect(result.success).toBe(false)
    expect(entrySchema.safeParse({
      ...entry,
      category: 'talk',
      talk: {
        materials: [{ ...talk.materials[0], url: '//example.com/slides.pdf' }],
      },
    }).success).toBe(false)
    expect(entrySchema.safeParse({
      ...entry,
      category: 'talk',
      talk: {
        materials: [{ ...talk.materials[0], url: '/talks/slides.pdf?token=secret' }],
      },
    }).success).toBe(false)
  })
})

describe('entry category contract', () => {
  const podcast = {
    show: 'A show',
    sourceUrl: 'https://example.com/episode',
    players: [{ service: 'spotify', url: 'https://example.com/spotify' }],
  }
  const talk = {
    materials: [{ label: 'Slides', type: 'pdf', url: '/talks/slides.pdf' }],
  }

  it.each(['essay', 'note', 'review', 'link', 'video', 'podcast', 'talk'])(
    'accepts only the metadata belonging to %s',
    (category) => {
      const metadata = category === 'podcast' ? { podcast }
        : category === 'talk' ? { talk } : {}
      expect(entrySchema.safeParse({ ...entry, category, ...metadata }).success).toBe(true)
      expect(entrySchema.safeParse({ ...entry, category, podcast, talk }).success).toBe(false)
      expect(entrySchema.safeParse({
        ...entry, category, ...metadata, privateId: 'private',
      }).success).toBe(false)
      if (category === 'podcast' || category === 'talk') {
        expect(entrySchema.safeParse({ ...entry, category }).success).toBe(false)
      } else {
        expect(entrySchema.safeParse({ ...entry, category, podcast }).success).toBe(false)
        expect(entrySchema.safeParse({ ...entry, category, talk }).success).toBe(false)
      }
    },
  )

  it('narrows required metadata by category', () => {
    const entries: EntryData[] = [
      entrySchema.parse({ ...entry, category: 'podcast', podcast }),
      entrySchema.parse({ ...entry, category: 'talk', talk }),
      entrySchema.parse(entry),
    ]
    for (const metadata of entries) {
      if (metadata.category === 'podcast') {
        expectTypeOf(metadata.podcast).toEqualTypeOf<PodcastData>()
        expectTypeOf(metadata.talk).toEqualTypeOf<undefined>()
        expect(metadata.podcast.show).toBe('A show')
      } else if (metadata.category === 'talk') {
        expectTypeOf(metadata.talk).toEqualTypeOf<TalkData>()
        expectTypeOf(metadata.podcast).toEqualTypeOf<undefined>()
        expect(metadata.talk.materials).toHaveLength(1)
      } else {
        expectTypeOf(metadata.podcast).toEqualTypeOf<undefined>()
        expectTypeOf(metadata.talk).toEqualTypeOf<undefined>()
        expect(metadata.category).toBe('note')
      }
    }
  })

  it('rejects either half of a hosted audio pair', () => {
    for (const audio of [{ audioUrl: '/podcasts/episode.mp3' }, { audioBytes: 1234 }]) {
      const result = entrySchema.safeParse({
        ...entry, category: 'podcast', podcast: { ...podcast, ...audio },
      })
      expect(result.success).toBe(false)
    }
  })
})

describe('projectSchema', () => {
  const project = {
    title: 'Desk cable guide',
    summary: 'A small printed guide for the cables under my desk.',
    order: 1,
    category: '3D print',
  } as const

  it('applies defaults to a valid project', () => {
    const result = projectSchema.parse(project)

    expect(result.kind).toBe('software')
    expect(result.technologies).toEqual([])
  })

  it('requires a visual for featured projects', () => {
    const result = projectSchema.safeParse({ ...project, featuredOrder: 1 })

    expect(result.success).toBe(false)
    expect(result.error?.issues.map(({ path }) => path[0])).toEqual(['visual'])
  })

  it('accepts complete image and code visuals', () => {
    expect(projectSchema.parse({
      ...project,
      featuredOrder: 1,
      visual: {
        type: 'image',
        src: '/projects/guide.webp',
        alt: 'The cable guide installed',
        width: 800,
        height: 600,
      },
    }).visual?.type).toBe('image')
    expect(projectSchema.parse({
      ...project,
      visual: { type: 'code', lines: ['const tidy = true'] },
    }).visual?.type).toBe('code')
  })

  it('rejects private metadata and invalid URLs', () => {
    expect(projectSchema.safeParse({ ...project, status: 'published' }).success).toBe(false)
    expect(projectSchema.safeParse({ ...project, privateId: 'private' }).success).toBe(false)
    expect(projectSchema.safeParse({ ...project, externalUrl: 'not a URL' }).success).toBe(false)
    expect(projectSchema.safeParse({ ...project, externalUrl: 'ftp://example.com' }).success)
      .toBe(false)
  })
})

it('parses both canonical public metadata variants without workflow state', () => {
  expect(parsePublicContentMetadata(entry).title).toBe('What I noticed')
  expect(parsePublicContentMetadata({
    title: 'Tool',
    summary: 'A useful tool.',
    order: 1,
    category: 'Tooling',
  }).title).toBe('Tool')
})
