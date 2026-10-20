let publishedCards

function previewCard(document, link, card, getAsset) {
  const anchor = document.createElement('a')
  anchor.className = `external-card${card.image ? ' external-card--image' : ''}`
  anchor.href = link.href
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  if (card.image) {
    const image = document.createElement('img')
    image.src = String(getAsset(card.image) ?? card.image)
    image.alt = card.imageAlt
    anchor.append(image)
  }
  const copy = document.createElement('span')
  copy.className = 'external-card-copy'
  for (const [tag, className, value] of [
    ['span', 'external-card-domain', new URL(link.href).hostname.replace(/^www\./u, '')],
    ['strong', '', card.title], ['span', 'external-card-description', card.description],
  ]) {
    if (!value) continue
    const element = document.createElement(tag)
    element.className = className
    element.textContent = value
    copy.append(element)
  }
  anchor.append(copy)
  return anchor
}

export function observePreviewLinks(document, cards, getAsset) {
  const root = document.querySelector('.content')
  if (!root) return () => {}
  const originals = new Map()
  const enhance = () => {
    for (const paragraph of root.querySelectorAll('p')) {
      const children = [...paragraph.childNodes].filter(node => node.nodeType === 1 || node.textContent.trim())
      const link = children[0]
      if (children.length !== 1 || link.tagName !== 'A') continue
      const card = cards.get(link.getAttribute('href'))
      if (card) {
        const replacement = previewCard(document, link, card, getAsset)
        originals.set(replacement, paragraph)
        paragraph.replaceWith(replacement)
      }
    }
  }
  const observer = new document.defaultView.MutationObserver(enhance)
  observer.observe(root, { childList: true, subtree: true })
  enhance()
  return () => {
    observer.disconnect()
    for (const [replacement, paragraph] of originals) {
      if (replacement.parentNode) replacement.replaceWith(paragraph)
    }
  }
}

export function loadPreviewLinks(document, authoredCards, getAsset, siteUrl) {
  let disposed = false
  let stop = () => {}
  publishedCards ??= fetch(new URL('/link-previews/index.json', siteUrl), { credentials: 'same-origin' })
    .then(response => { if (!response.ok) throw Error('Preview metadata unavailable'); return response.json() })
    .catch(() => ({}))
  void publishedCards.then(saved => {
    if (disposed) return
    const cards = new Map(Object.entries(saved))
    for (const card of authoredCards ?? []) cards.set(card.url, card)
    stop = observePreviewLinks(document, cards, getAsset)
  })
  return () => { disposed = true; stop() }
}
