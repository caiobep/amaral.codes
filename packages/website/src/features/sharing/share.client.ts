import {
  copyWithFallback,
  shareOrCopy,
  type ShareDependencies,
  type ShareResult,
} from './share'

const STATUS_LABELS: Record<ShareResult, string> = {
  cancelled: 'Share',
  copied: 'Link copied',
  failed: 'Copy failed',
  shared: 'Shared',
}

const getShareData = (button: HTMLButtonElement): ShareData => ({
  title: button.dataset.shareTitle ?? document.title,
  ...(button.dataset.shareText ? { text: button.dataset.shareText } : {}),
  url: button.dataset.shareUrl ?? window.location.href,
})

const copyWithSelection = (text: string): boolean => {
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.readOnly = true
  Object.assign(textarea.style, {
    position: 'fixed',
    top: '0',
    left: '-9999px',
    width: '1px',
    height: '1px',
    fontSize: '16px',
    opacity: '0',
  })
  document.body.append(textarea)
  textarea.focus({ preventScroll: true })
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Required when secure clipboard access is unavailable.
  const copied = document.execCommand('copy')
  textarea.remove()
  activeElement?.focus({ preventScroll: true })
  return copied
}

const getDependencies = (): ShareDependencies => {
  const clipboard = (navigator as { clipboard?: Clipboard }).clipboard
  return {
    ...(typeof navigator.share === 'function' ? { share: navigator.share.bind(navigator) } : {}),
    copy: text => copyWithFallback(text, {
      ...(clipboard ? { clipboard: clipboard.writeText.bind(clipboard) } : {}),
      legacyCopy: copyWithSelection,
    }),
  }
}

const resetStatus = (button: HTMLButtonElement, label: HTMLElement) => {
  delete button.dataset.shareState
  label.textContent = STATUS_LABELS.cancelled
}

const showStatus = (button: HTMLButtonElement, label: HTMLElement, result: ShareResult) => {
  if (result === 'cancelled') return
  button.dataset.shareState = result
  label.textContent = STATUS_LABELS[result]
  window.setTimeout(() => resetStatus(button, label), 1800)
}

const handleShare = async (button: HTMLButtonElement, label: HTMLElement) => {
  button.disabled = true
  const result = await shareOrCopy(getShareData(button), getDependencies())
  button.disabled = false
  showStatus(button, label, result)
}

const bindShareButton = (button: HTMLButtonElement) => {
  if (button.dataset.shareReady === 'true') return
  const label = button.querySelector<HTMLElement>('[data-share-label]')
  if (!label) return

  button.dataset.shareReady = 'true'
  button.addEventListener('click', () => void handleShare(button, label))
}

export const initializeShareControls = () => {
  document.querySelectorAll<HTMLButtonElement>('[data-share-button]').forEach(bindShareButton)
}
