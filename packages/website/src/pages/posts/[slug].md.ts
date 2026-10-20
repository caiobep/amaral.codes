import type { APIRoute, GetStaticPaths } from 'astro'
import type { CollectionEntry } from 'astro:content'
import { getEntryHref } from '../../lib/routes'
import { getEntryIndex } from '../../lib/content'
import { renderEntryMarkdown } from '../../lib/agent-markdown'
import { cmsTrialEnabled } from '../../lib/cms/mode'

interface Props {
  entry: CollectionEntry<'entries'>
}

export const getStaticPaths: GetStaticPaths = async () => {
  const { entries } = await getEntryIndex()

  return entries.filter(entry => getEntryHref(entry.id, entry.data.translation) === `/posts/${entry.id}`).map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }))
}

export const GET: APIRoute<Props> = async ({ props, site, params }) => {
  const entry = cmsTrialEnabled
    ? (await getEntryIndex()).entries.find(entry => entry.id === params.slug)
    : props.entry
  if (!entry) return new Response('Post not found', { status: 404 })
  const canonicalUrl = new URL(getEntryHref(entry.id, entry.data.translation), site).href
  const markdown = renderEntryMarkdown({
    body: entry.body ?? '',
    canonicalUrl,
    data: entry.data,
  })

  return new Response(markdown, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  })
}
