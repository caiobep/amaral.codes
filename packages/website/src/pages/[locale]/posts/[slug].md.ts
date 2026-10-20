import type { APIRoute, GetStaticPaths } from 'astro'
import type { CollectionEntry } from 'astro:content'
import { getCollection } from 'astro:content'
import { originalSlug, translatedPath } from '../../../features/articles/translations'
import { renderEntryMarkdown } from '../../../lib/agent-markdown'

interface Props { entry: CollectionEntry<'entries'> }

export const getStaticPaths: GetStaticPaths = async () => {
  const entries = await getCollection('entries')
  return entries.filter(entry => /^\/(en|pt-br)\/posts\//u.test(translatedPath(entry))).map(entry => ({
    params: { locale: entry.data.language?.toLowerCase(), slug: originalSlug(entry) },
    props: { entry },
  }))
}

export const GET: APIRoute<Props> = ({ props, site }) => new Response(renderEntryMarkdown({
  body: props.entry.body ?? '',
  canonicalUrl: new URL(translatedPath(props.entry), site).href,
  data: props.entry.data,
}), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
