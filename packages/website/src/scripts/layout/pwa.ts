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

export const initializePwa = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  if (initialized) return
  initialized = true
  registerAfterLoad()
}
