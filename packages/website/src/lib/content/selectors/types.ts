import type {
  EntryData,
  ProjectData,
} from '../../../content/schemas'

export interface ContentRecord<Data> {
  id: string
  data: Data
}

export type EntryRecord = ContentRecord<
  Pick<EntryData, 'category' | 'date'> &
  Partial<Pick<EntryData, 'featuredOrder' | 'topics' | 'translation'>>
>

export type ProjectRecord = ContentRecord<
  Pick<ProjectData, 'kind' | 'order'> &
  Partial<Pick<ProjectData, 'externalUrl' | 'featuredOrder' | 'technologies'>>
>
