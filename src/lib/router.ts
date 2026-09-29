import { useEffect, useState } from 'react'

export type AppRoute =
  | { name: 'setup' }
  | { name: 'pairings' }
  | { name: 'unit'; unitId: string }
  | { name: 'unit-route'; unitId: string }
  | { name: 'preview' }

export type Lens = 'pairings' | 'individual' | 'preview'

/** Sentinel unit id until the roster store lands — the shell has no dataset. */
export const FIRST_UNIT = '@first'

export function parseHash(hash: string): AppRoute {
  const path = hash.replace(/^#\/?/, '')
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  if (parts[0] === 'setup') return { name: 'setup' }
  if (parts[0] === 'preview') return { name: 'preview' }
  if (parts[0] === 'unit' && parts[1]) {
    if (parts[2] === 'route') return { name: 'unit-route', unitId: parts[1] }
    return { name: 'unit', unitId: parts[1] }
  }
  return { name: 'pairings' }
}

export function routeToHash(route: AppRoute): string {
  switch (route.name) {
    case 'setup':
      return '#/setup'
    case 'preview':
      return '#/preview'
    case 'unit':
      return `#/unit/${encodeURIComponent(route.unitId)}`
    case 'unit-route':
      return `#/unit/${encodeURIComponent(route.unitId)}/route`
    default:
      return '#/pairings'
  }
}

export function lensOf(route: AppRoute): Lens {
  if (route.name === 'preview') return 'preview'
  if (route.name === 'unit' || route.name === 'unit-route') return 'individual'
  return 'pairings'
}

export function navigate(route: AppRoute): void {
  const next = routeToHash(route)
  if (window.location.hash !== next) window.location.hash = next
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
