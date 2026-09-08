import type { APIRoute, GetStaticPaths } from 'astro'
import type { CollectionEntry } from 'astro:content'
import { getEntryIndex } from '../../lib/content'
import { renderEntryMarkdown } from '../../lib/agent-markdown'

interface Props {
  entry: CollectionEntry<'entries'>
}

export const getStaticPaths: GetStaticPaths = async () => {
  const { entries } = await getEntryIndex()

  return entries.map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }))
}

export const GET: APIRoute<Props> = ({ props, site }) => {
  const canonicalUrl = new URL(`/posts/${props.entry.id}`, site).href
  const markdown = renderEntryMarkdown({
    body: props.entry.body ?? '',
    canonicalUrl,
    data: props.entry.data,
  })

  return new Response(markdown, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  })
}
