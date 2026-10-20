import type { EntryData, ProjectData } from '../../content/schemas'
import {
  getEntryTopics,
  getProjectHref,
  type EntryRecord,
  type ProjectRecord,
} from '../content/selectors'
import type { SearchDocument } from '../../features/search/search-document'
import { getEntryHref } from '../routes'

type EntrySearchSource = EntryRecord & {
  body?: string
  data: EntryRecord['data'] & Pick<EntryData, 'summary' | 'title'>
}

type ProjectSearchSource = ProjectRecord & {
  body?: string
  data: ProjectRecord['data'] & Pick<ProjectData, 'category' | 'summary' | 'title'>
}

export const createSearchDocuments = (
  entries: readonly EntrySearchSource[],
  projects: readonly ProjectSearchSource[],
): SearchDocument[] => [
  ...entries.map((entry) => ({
    id: `post:${entry.id}`,
    type: 'writing' as const,
    title: entry.data.title,
    summary: entry.data.summary ?? '',
    content: entry.body ?? '',
    href: getEntryHref(entry.id, entry.data.translation),
    category: entry.data.category,
    topics: getEntryTopics(entry),
    date: entry.data.date,
    external: false,
  })),
  ...projects.map((project) => ({
    id: `project:${project.id}`,
    type: 'project' as const,
    title: project.data.title,
    summary: project.data.summary,
    content: project.body ?? '',
    href: getProjectHref(project),
    category: project.data.category,
    topics: project.data.technologies ?? [],
    external: Boolean(project.data.externalUrl),
  })),
]
