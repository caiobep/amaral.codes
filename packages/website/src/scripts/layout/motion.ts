const setStaggerIndexes = () => {
  document.querySelectorAll('[data-stagger]').forEach((group) => {
    Array.from(group.children).forEach((child, index) => {
      if (!(child instanceof HTMLElement)) return
      child.style.setProperty('--stagger-index', String(Math.min(index, 6)))
    })
  })
}

function createRevealObserver() {
  return new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      observer.unobserve(entry.target)
    })
  }, { rootMargin: '0px 0px -5% 0px', threshold: 0.04 })
}

const observeRevealItems = (items: NodeListOf<Element>) => {
  const observer = createRevealObserver()

  items.forEach((item) => {
    if (item.getAttribute('data-reveal-ready') === 'true') return
    item.setAttribute('data-reveal-ready', 'true')

    if (item.getBoundingClientRect().top < window.innerHeight * 0.92) {
      item.classList.add('is-visible')
      return
    }

    observer.observe(item)
  })
}

const revealPageItems = (reduceMotion: boolean) => {
  const items = document.querySelectorAll('[data-reveal]')
  if (reduceMotion) { items.forEach((item) => item.classList.add('is-visible')); return }
  observeRevealItems(items)
}

const initializePortraitMotion = (reduceMotion: boolean) => {
  const portraits = document.querySelectorAll<HTMLElement>('[data-portrait-motion]')
  const canUsePointerMotion = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  if (reduceMotion || !canUsePointerMotion) return

  portraits.forEach((portrait) => {
    if (portrait.dataset.pointerMotion === 'ready') return

    portrait.dataset.pointerMotion = 'ready'
    portrait.addEventListener('pointermove', (event) => {
      const bounds = portrait.getBoundingClientRect()
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 10
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 8
      portrait.style.setProperty('--portrait-x', `${String(x)}px`)
      portrait.style.setProperty('--portrait-y', `${String(y)}px`)
    })
    portrait.addEventListener('pointerleave', () => {
      portrait.style.setProperty('--portrait-x', '0px')
      portrait.style.setProperty('--portrait-y', '0px')
    })
  })
}

const resetLeadStoryTilt = (card: HTMLElement) => {
  delete card.dataset.parallaxActive
  card.style.setProperty('--lead-rotate-x', '0deg')
  card.style.setProperty('--lead-rotate-y', '0deg')
}

const updateLeadStoryTilt = (
  card: HTMLElement,
  bounds: DOMRect,
  event: PointerEvent,
) => {
  const horizontal = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
  const vertical = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2

  card.dataset.parallaxActive = 'true'
  card.style.setProperty('--lead-rotate-x', `${String(vertical * -1.25)}deg`)
  card.style.setProperty('--lead-rotate-y', `${String(horizontal * 1.6)}deg`)
}

const initializeLeadStoryMotion = (reduceMotion: boolean) => {
  const canUsePointerMotion = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  if (reduceMotion || !canUsePointerMotion) return

  document.querySelectorAll<HTMLElement>('[data-lead-story-motion]').forEach((card) => {
    if (card.dataset.pointerMotion === 'ready') return

    let bounds: DOMRect | undefined
    card.dataset.pointerMotion = 'ready'
    card.addEventListener('pointerenter', (event) => {
      bounds = card.getBoundingClientRect()
      updateLeadStoryTilt(card, bounds, event)
    })
    card.addEventListener('pointermove', (event) => {
      if (!bounds) return
      updateLeadStoryTilt(card, bounds, event)
    })
    card.addEventListener('pointerleave', () => {
      bounds = undefined
      resetLeadStoryTilt(card)
    })
  })
}

export const initializePageMotion = () => {
  const root = document.documentElement
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches
  const arrivedBySwipe = ['next', 'previous'].includes(
    root.dataset.navigationDirection ?? '',
  )
  const suppressRevealMotion = reduceMotion || arrivedBySwipe || coarsePointer

  setStaggerIndexes()
  revealPageItems(suppressRevealMotion)
  root.classList.add('reveal-ready')
  initializePortraitMotion(reduceMotion)
  initializeLeadStoryMotion(reduceMotion)
}
