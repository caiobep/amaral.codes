import { disableTrialOfflineCache } from './trial-offline'

const registerServiceWorker = async () => {
  try {
    await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
      updateViaCache: 'none',
    })
  } catch (error) {
    console.warn('Offline support could not be enabled.', error)
  }
}

let initialized = false

const registerAfterLoad = () => {
  if (document.readyState === 'complete') {
    void registerServiceWorker()
    return
  }
  window.addEventListener('load', () => void registerServiceWorker(), { once: true })
}

const isPrivatePreview = () => import.meta.env.AMARAL_CMS_TRIAL === '1' || import.meta.env.AMARAL_PUBLISHING === '1'

export const initializePwa = () => {
  if (isPrivatePreview()) {
    if ('serviceWorker' in navigator) void disableTrialOfflineCache()
    return
  }
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  if (initialized) return
  initialized = true
  registerAfterLoad()
}
