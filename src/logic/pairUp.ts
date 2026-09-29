export type PairUpRank = 'C' | 'B' | 'A' | 'S'

const STAT_COUNT = 8
const RANK_INDEX: Record<PairUpRank, number> = { C: 0, B: 1, A: 2, S: 3 }

/** Adds a support unit's class bonus and the cumulative C/B/A/S support rows. */
export function pairUpBonus(
  classBonus: readonly number[] | null | undefined,
  supportBonuses: readonly (readonly number[])[] | null | undefined,
  rank: PairUpRank | null,
): number[] {
  const result = Array.from({ length: STAT_COUNT }, (_, index) => classBonus?.[index] ?? 0)
  if (rank === null || !supportBonuses) return result

  for (let row = 0; row <= RANK_INDEX[rank]; row += 1) {
    const bonuses = supportBonuses[row]
    if (!bonuses) continue
    for (let stat = 0; stat < STAT_COUNT; stat += 1) {
      result[stat] += bonuses[stat] ?? 0
    }
  }

  return result
}
