import type { RunPlan } from '../state/model'

export type ChartCard = { kind: 'pair'; front: string; back: string } | { kind: 'solo'; unitId: string }

/** Pairs (front on top) in the roster's order of their first-listed member, then solos. */
export function chartCards(orderedIds: readonly string[], run: RunPlan, linkPairs = true): ChartCard[] {
  const listed = new Set(orderedIds)
  const placed = new Set<string>()
  const order = new Map(orderedIds.map((id, index) => [id, index]))
  const cards: { position: number; card: ChartCard }[] = []
  for (const [index, id] of orderedIds.entries()) {
    if (placed.has(id)) continue
    placed.add(id)
    const partner = run.units[id]?.pairPartner
    if (partner && listed.has(partner) && run.units[partner]?.pairPartner === id) {
      placed.add(partner)
      const front = run.units[id]?.pairRole === 'back' ? partner : id
      const anchor = linkPairs ? id : front
      cards.push({ position: order.get(anchor) ?? index, card: { kind: 'pair', front, back: front === id ? partner : id } })
    } else {
      cards.push({ position: index, card: { kind: 'solo', unitId: id } })
    }
  }
  return cards.sort((a, b) => a.position - b.position).map(({ card }) => card)
}
