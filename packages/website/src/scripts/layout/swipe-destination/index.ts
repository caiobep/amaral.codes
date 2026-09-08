export type SwipeDirection = 'next' | 'previous'

interface SwipeDestination {
  direction: SwipeDirection
  currentIndex: number
  navHrefs: string[]
  overrideHref?: string | undefined
}

export const resolveSwipeDestination = ({
  direction,
  currentIndex,
  navHrefs,
  overrideHref,
}: SwipeDestination) => {
  if (overrideHref) return overrideHref
  const offset = direction === 'next' ? 1 : -1
  return navHrefs[currentIndex + offset]
}
