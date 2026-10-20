export function sharingArtwork(data) {
  const title = (data.sharing?.title || data.title || 'Untitled').replace(/\s+/gu, ' ').trim()
  const summary = (data.sharing?.description || data.summary || '').replace(/\s+/gu, ' ').trim()
  const characters = Array.from(summary)
  const date = new Date(data.date)
  const published = data.date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(data.language || 'en', { dateStyle: 'long', timeZone: 'UTC' }).format(date)
    : ''
  return {
    title,
    summary: characters.length > 155 ? characters.slice(0, 152).join('').replace(/\s+\S*$/u, '') + '…' : summary,
    metadata: [data.category || 'note', published].filter(Boolean).join(' / '),
    fontSize: title.length > 100 ? 68 : 92,
  }
}

export function createSharingArtwork({ createElement: h, useEffect, useRef }) {
  return function SharingArtwork({ data }) {
    const artwork = sharingArtwork(data)
    const title = useRef(null)
    useEffect(() => {
      const element = title.current
      const fit = () => {
        const width = element.parentElement.clientWidth
        let size = width * artwork.fontSize / 1200
        element.style.fontSize = `${size}px`
        while (element.scrollHeight > element.clientHeight + 1 && size > 8) {
          size -= 1
          element.style.fontSize = `${size}px`
        }
      }
      const observer = new ResizeObserver(fit)
      observer.observe(element.parentElement)
      void element.ownerDocument.fonts.ready.then(fit)
      return () => observer.disconnect()
    }, [artwork.title, artwork.fontSize])
    return h('div', { className: 'sharing-artwork', role: 'img', 'aria-label': `${artwork.title} — Caio Amaral` },
      h('span', { className: 'sharing-artwork-brand' }, 'Caio Amaral'),
      h('span', { className: 'sharing-artwork-meta' }, artwork.metadata),
      h('span', { className: 'sharing-artwork-title', ref: title }, artwork.title),
      h('span', { className: 'sharing-artwork-summary' }, artwork.summary),
      h('span', { className: 'sharing-artwork-site' }, 'amaral.codes'),
    )
  }
}
