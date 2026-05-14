import { defineConfig } from 'astro/config'

import tailwind from '@astrojs/tailwind'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'

const importedBlockArtifacts = new Set([
  'child_database',
  'child_page',
  'column',
  'column_list',
  'synced_block',
  'table_of_contents',
  'unsupported',
])

const getText = (node) => {
  if (!node) return ''
  if (typeof node.value === 'string') return node.value
  if (!Array.isArray(node.children)) return ''
  return node.children.map(getText).join('')
}

const getDomain = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const isNotionUrl = (url) => {
  try {
    const { hostname, pathname } = new URL(url)
    return (
      hostname.includes('notion.so') ||
      hostname.includes('notion-static.com') ||
      pathname.includes('notion-static.com')
    )
  } catch {
    return url.includes('notion.so') || url.includes('notion-static.com')
  }
}

const sanitizeImportedNotionArtifacts = () => {
  const cleanNode = (node) => {
    if (!Array.isArray(node.children)) return

    node.children = node.children.flatMap((child) => {
      if (child.type === 'paragraph') {
        const text = getText(child).trim().toLowerCase()
        if (importedBlockArtifacts.has(text)) return []

        const meaningfulChildren = child.children?.filter((item) => item.type !== 'text' || item.value.trim())
        if (
          meaningfulChildren?.length === 1 &&
          meaningfulChildren[0].type === 'link' &&
          getText(meaningfulChildren[0]).trim().toLowerCase() === 'bookmark'
        ) {
          meaningfulChildren[0].children = [{ type: 'text', value: getDomain(meaningfulChildren[0].url) }]
        }
      }

      if (child.type === 'link' && isNotionUrl(child.url)) {
        return child.children?.length ? child.children : [{ type: 'text', value: getDomain(child.url) }]
      }

      cleanNode(child)
      return [child]
    })
  }

  return (tree) => cleanNode(tree)
}

export default defineConfig({
  site: 'https://amaral.codes',
  integrations: [tailwind(), mdx({ wrap: true, remarkPlugins: [sanitizeImportedNotionArtifacts] }), sitemap()],
  markdown: {
    remarkPlugins: [sanitizeImportedNotionArtifacts],
  },
})
