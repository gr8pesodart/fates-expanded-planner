import { useEffect, useState } from 'react'

export type CharacterTab = 'avatar' | 'profile' | 'stats' | 'progression'

export const CHARACTER_TABS: readonly CharacterTab[] = ['avatar', 'profile', 'stats', 'progression']

export type AppRoute =
  | { name: 'roster' }
  | { name: 'unit'; unitId: string; tab: CharacterTab }
  | { name: 'chart'; shareToken?: string }
  | { name: 'runs' }
  | { name: 'new-run' }

export type NavSection = 'roster' | 'chart' | 'runs'

export function parseHash(hash: string): AppRoute {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?', 2)
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  if (parts[0] === 'chart') {
    const shareToken = new URLSearchParams(query).get('plan') ?? undefined
    return shareToken ? { name: 'chart', shareToken } : { name: 'chart' }
  }
  if (parts[0] === 'runs') return parts[1] === 'new' ? { name: 'new-run' } : { name: 'runs' }
  if (parts[0] === 'unit' && parts[1]) {
    const tab = CHARACTER_TABS.find((item) => item === parts[2]) ?? 'profile'
    return { name: 'unit', unitId: parts[1], tab }
  }
  return { name: 'roster' }
}

export function routeToHash(route: AppRoute): string {
  switch (route.name) {
    case 'chart':
      return route.shareToken ? `#/chart?plan=${encodeURIComponent(route.shareToken)}` : '#/chart'
    case 'runs':
      return '#/runs'
    case 'new-run':
      return '#/runs/new'
    case 'unit':
      return `#/unit/${encodeURIComponent(route.unitId)}/${route.tab}`
    default:
      return '#/roster'
  }
}

export function sectionOf(route: AppRoute): NavSection {
  if (route.name === 'chart') return 'chart'
  if (route.name === 'runs' || route.name === 'new-run') return 'runs'
  return 'roster'
}

// Entries this app pushed; a deep-linked character page has none, so Back falls back to the roster.
let pushedEntries = 0

export function navigate(route: AppRoute, options: { replace?: boolean } = {}): void {
  const next = routeToHash(route)
  if (window.location.hash === next) return
  if (options.replace) {
    window.location.replace(next)
    return
  }
  pushedEntries += 1
  window.location.hash = next
}

/** Back from a character page returns to wherever it was opened from (roster or chart). */
export function goBack(fallback: AppRoute = { name: 'roster' }): void {
  if (pushedEntries > 0) {
    pushedEntries -= 1
    window.history.back()
    return
  }
  navigate(fallback, { replace: true })
}

export function useRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
