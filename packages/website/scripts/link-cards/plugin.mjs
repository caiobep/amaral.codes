function cardMarkup(card, href) {
  const text = (tagName, className, value) => ({ type: 'element', tagName, properties: { className }, children: [{ type: 'text', value }] })
  const copy = [text('span', 'external-card-domain', new URL(href).hostname.replace(/^www\./u, '')), text('strong', '', card.title)]
  if (card.description) copy.push(text('span', 'external-card-description', card.description))
  const children = [{ type: 'element', tagName: 'span', properties: { className: 'external-card-copy' }, children: copy }]
  if (card.image) children.unshift({ type: 'element', tagName: 'img', properties: { src: card.image, alt: card.imageAlt, width: 160, height: 100, loading: 'lazy', decoding: 'async', referrerPolicy: 'no-referrer' }, children: [] })
  return { type: 'element', tagName: 'a', properties: { href, className: ['external-card', ...(card.image ? ['external-card--image'] : [])], target: '_blank', rel: ['noopener', 'noreferrer'] }, children }
}

function standaloneLink(node) {
  const contents = node.children.filter(item => item.type !== 'text' || item.value.trim())
  if (contents.length === 1 && contents[0].tagName === 'a') return contents[0]
}

function entryCards(context) {
  return context.data.astro?.frontmatter?.linkCards ?? []
}

export default function richLinkCards() {
  return {
    name: 'rich-link-cards',
    element: {
      filter: ['p'],
      visit(node, context) {
        const link = standaloneLink(node)
        if (!link) return
        const href = link.properties.href
        const card = entryCards(context).find(item => item.url === href)
        if (card) return cardMarkup(card, href)
      },
    },
  }
}
