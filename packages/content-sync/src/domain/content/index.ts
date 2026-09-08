import type { PublicContentMetadata } from '@amaral.codes/content-contract'

export const COLLECTIONS = ['entries', 'podcasts', 'projects'] as const

export type CollectionName = (typeof COLLECTIONS)[number]
export type ContentPartition =
  | 'essays'
  | 'links'
  | 'notes'
  | 'podcasts'
  | 'reviews'
  | 'talks'
  | 'videos'

export interface ContentDocument<
  TMetadata extends PublicContentMetadata = PublicContentMetadata,
> {
  content: string
  metadata: TMetadata
  slug: string
}

export interface ContentIdentity<
  TMetadata extends PublicContentMetadata = PublicContentMetadata,
> extends Omit<ContentDocument<TMetadata>, 'content'> {
  partition?: ContentPartition
}
