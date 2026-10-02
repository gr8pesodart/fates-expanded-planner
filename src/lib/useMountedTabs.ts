import { useEffect, useState } from 'react'

/**
 * Pages stay mounted once shown, so a swipe reveals the neighbour's real content instead of it
 * popping in. The opening page renders first; the rest mount once the opening animation is done.
 */
export function useMountedTabs<T extends string>(active: T, tabs: readonly T[], delay = 480): Set<T> {
  const [mounted, setMounted] = useState<Set<T>>(() => new Set([active]))
  if (!mounted.has(active)) setMounted(new Set([...mounted, active]))
  const all = tabs.join(' ')
  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(new Set(all.split(' ') as T[])), delay)
    return () => window.clearTimeout(timer)
  }, [all, delay])
  return mounted
}
