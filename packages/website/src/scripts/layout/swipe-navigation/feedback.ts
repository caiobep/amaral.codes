import type { SwipeDirection } from './types'

export function triggerSwipeFeedback(direction: SwipeDirection) {
  const root = document.documentElement
  let hapticPlayed = false

  delete root.dataset.swipeFeedback
  root.getBoundingClientRect()
  root.style.setProperty('--swipe-feedback-top', `${String(window.scrollY + window.innerHeight / 2)}px`)
  root.dataset.swipeFeedback = direction

  try {
    hapticPlayed = navigator.vibrate(12)
  } catch {
    // Vibration is optional and unavailable in WebKit on Apple mobile platforms.
  }

  root.dataset.swipeFeedbackMode = hapticPlayed ? 'haptic' : 'visual'
  window.setTimeout(() => clearFeedback(root, direction), 180)
}

function clearFeedback(root: HTMLElement, direction: SwipeDirection) {
  if (root.dataset.swipeFeedback === direction) delete root.dataset.swipeFeedback
  delete root.dataset.swipeFeedbackMode
  root.style.removeProperty('--swipe-feedback-top')
}
