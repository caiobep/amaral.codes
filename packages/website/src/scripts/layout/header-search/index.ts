const getBackwardsWrapTarget = (activeIndex: number, focusableCount: number) => (
  activeIndex <= 0 ? focusableCount - 1 : undefined
)

const getForwardsWrapTarget = (activeIndex: number, focusableCount: number) => (
  activeIndex < 0 || activeIndex === focusableCount - 1 ? 0 : undefined
)

export const getFocusWrapTarget = (
  activeIndex: number,
  focusableCount: number,
  backwards: boolean,
) => {
  if (focusableCount === 0) return undefined
  return backwards
    ? getBackwardsWrapTarget(activeIndex, focusableCount)
    : getForwardsWrapTarget(activeIndex, focusableCount)
}
