import type {
  PublicContentMetadata,
} from '@amaral.codes/content-contract'
import type {
  ContentDocument,
  ContentIdentity,
} from '../domain/content/index.ts'

export interface CollectionSource<TSource> {
  list: (sourceId: string) => Promise<TSource[]>
}

export interface ContentMapper<
  TSource,
  TMetadata extends PublicContentMetadata = PublicContentMetadata,
> {
  isPublished: (source: TSource) => boolean
  map: (source: TSource) => ContentIdentity<TMetadata>
}

export interface DocumentExporter<TSource, TScope> {
  export: (options: {
    identity: ContentIdentity
    scope: TScope
    source: TSource
  }) => Promise<void>
}

export interface DocumentReader<TSource> {
  read: (source: TSource) => Promise<string>
}

export interface DocumentMaterializer<TSource> {
  materialize: (
    markdown: string,
    destination: string,
    source: TSource,
  ) => Promise<string>
}

export interface DocumentDestinationResolver {
  resolve: (root: string, identity: ContentIdentity) => string
}

export interface DocumentWriter {
  write: (destination: string, document: ContentDocument) => Promise<void>
}

export interface SnapshotStore<TScope> {
  replace: (
    writeSnapshot: (scope: TScope) => Promise<void>,
  ) => Promise<void>
}

export interface SlugReservationSource {
  list: () => Promise<ReadonlySet<string>>
}
