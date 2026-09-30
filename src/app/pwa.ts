import { registerSW } from 'virtual:pwa-register'

const HOURLY = 60 * 60 * 1000
const MIN_GAP = 60 * 1000

/**
 * iOS home-screen apps are resumed from memory rather than relaunched, so the browser's own update
 * check (on navigation, at most daily) can leave them on an old build for days. Check for a new
 * service worker whenever the app returns to the foreground and hourly while open; in autoUpdate
 * mode `registerSW` reloads the page once the new worker takes control. Plans persist to
 * localStorage on every change, so the reload only drops transient UI.
 */
export function registerUpdates(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      let lastCheck = Date.now()
      const check = async () => {
        if (!navigator.onLine || registration.installing || Date.now() - lastCheck < MIN_GAP) return
        lastCheck = Date.now()
        // Offline or host errors just mean "try again next time".
        await registration.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void check()
      })
      window.setInterval(() => void check(), HOURLY)
    },
  })
}
