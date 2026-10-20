import { defineLiveCollection } from 'astro:content'

export const collections = import.meta.env.AMARAL_CMS_TRIAL === '1' ? {
  _emdash: defineLiveCollection({ loader: (await import('emdash/runtime')).emdashLoader() }),
} : {}
