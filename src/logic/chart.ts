import type { RunPlan } from '../state/model'

export type ChartCard = { kind: 'pair'; front: string; back: string } | { kind: 'solo'; unitId: string }

/** Pairs (front on top) in the roster's order of their first-listed member, then solos. */
export function chartCards(orderedIds: readonly string[], run: RunPlan): ChartCard[] {
  const listed = new Set(orderedIds)
  const placed = new Set<string>()
  const pairs: ChartCard[] = []
  const solos: ChartCard[] = []
  for (const id of orderedIds) {
    if (placed.has(id)) continue
    placed.add(id)
    const partner = run.units[id]?.pairPartner
    if (partner && listed.has(partner) && run.units[partner]?.pairPartner === id) {
      placed.add(partner)
      const front = run.units[id]?.pairRole === 'back' ? partner : id
      pairs.push({ kind: 'pair', front, back: front === id ? partner : id })
    } else {
      solos.push({ kind: 'solo', unitId: id })
    }
  }
  return [...pairs, ...solos]
}
