import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { Plan } from '../state/plansStore'

const HASH_PREFIX = 'plan='

/** Build a shareable URL that embeds one plan (compressed into the hash). */
export function shareUrl(plan: Plan): string {
  const payload = compressToEncodedURIComponent(JSON.stringify(plan))
  const url = new URL(window.location.href)
  url.hash = `${HASH_PREFIX}${payload}`
  return url.toString()
}

/** Read a plan from the current URL hash, if one is present and valid. */
export function readSharedPlan(): Plan | null {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash.startsWith(HASH_PREFIX)) return null
  try {
    const json = decompressFromEncodedURIComponent(hash.slice(HASH_PREFIX.length))
    if (!json) return null
    const parsed = JSON.parse(json) as Plan
    if (typeof parsed?.id !== 'string' || typeof parsed?.name !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export function clearShareHash(): void {
  history.replaceState(null, '', window.location.pathname + window.location.search)
}
