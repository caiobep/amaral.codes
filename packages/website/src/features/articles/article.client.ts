interface StandaloneLink {
  link: HTMLAnchorElement
  text: string
}

export function initializeArticleBeforePaint() {
  const isMeaningfulNode = (node: ChildNode) =>
    node.nodeType === Node.ELEMENT_NODE || Boolean(node.textContent?.trim())

  const getStandaloneLink = (paragraph: HTMLParagraphElement): StandaloneLink | undefined => {
    const links = paragraph.querySelectorAll<HTMLAnchorElement>('a')
    if (links.length !== 1) return undefined

    const link = links.item(0)
    const text = paragraph.textContent.trim()
    if (!text) return undefined

    const meaningfulNodes = Array.from(paragraph.childNodes).filter(isMeaningfulNode)
    if (meaningfulNodes.length !== 1) return undefined
    if (meaningfulNodes[0] !== link) return undefined
    return { link, text }
  }

  const getLinkDomain = (link: HTMLAnchorElement) => {
    try {
      return new URL(link.href).hostname.replace(/^www\./, '')
    } catch {
      return link.href
    }
  }

  const createExternalCard = ({ link, text }: StandaloneLink) => {
    const domain = getLinkDomain(link)
    const card = document.createElement('a')
    const label = document.createElement('span')
    const title = document.createElement('strong')

    card.className = 'external-card'
    Object.assign(card, {
      href: link.href,
      target: '_blank',
      rel: 'noopener noreferrer',
    })
    label.textContent = domain
    title.textContent = text === domain ? domain : text
    card.append(label, title)
    return card
  }

  const enhanceExternalCards = () => {
    document.querySelectorAll<HTMLParagraphElement>('.content p').forEach((paragraph) => {
      const standaloneLink = getStandaloneLink(paragraph)
      if (!standaloneLink) return
      paragraph.replaceWith(createExternalCard(standaloneLink))
    })
  }

  document.addEventListener('astro:page-load', enhanceExternalCards)
  enhanceExternalCards()
}

export const createArticleBootstrapScript = () =>
  `(${initializeArticleBeforePaint.toString()})()`
