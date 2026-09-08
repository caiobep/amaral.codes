import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { createContentId } from '@amaral.codes/content-contract/content-id'
import { projectSchema, entrySchema } from './content/schemas'

const contentSource = process.env.AMARAL_CONTENT_SOURCE

const entriesBase = contentSource === 'fixtures'
  ? './tests/fixtures/content/entries'
  : './src/content/entries'

const getEntryFilename = (entry: string) => {
  const filename = entry.split('/').at(-1)
  if (filename) return filename
  throw new Error(`Cannot create a content ID for an empty entry: ${entry}`)
}

const getLegacyEntryId = ({ entry }: { entry: string }) => createContentId(
  getEntryFilename(entry).replace(/\.[^.]+$/, ''),
)

const entriesCollection = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: entriesBase,
    generateId: getLegacyEntryId,
  }),
  schema: entrySchema,
})

const projectsCollection = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/projects',
    generateId: getLegacyEntryId,
  }),
  schema: projectSchema,
})

export const collections = {
  entries: entriesCollection,
  projects: projectsCollection,
}
