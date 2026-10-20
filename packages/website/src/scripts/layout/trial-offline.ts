export async function disableTrialOfflineCache() {
  const registrations = await navigator.serviceWorker.getRegistrations()
  const siteWorkers = registrations.filter(registration => (
    registration.active && new URL(registration.active.scriptURL).pathname === '/service-worker.js'
  ))
  await Promise.all(siteWorkers.map(registration => registration.unregister()))
  const names = await caches.keys()
  await Promise.all(names.filter(name => name.startsWith('amaral-')).map(name => caches.delete(name)))
}
