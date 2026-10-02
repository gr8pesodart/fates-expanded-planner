import type { Dataset } from '../data/types'
import { bookItemKey, classItemKey, itemName, sealItemKey } from '../data/itemIcons'
import type { RunPlan } from '../state/model'
import type { UnitContext } from './army'
import { skillBooksUsed } from './autoProgression'
import type { Progression, ReclassSeal, SealUse } from './progression'
import { buildProgression, learnedSkillIds, sealsUsed } from './progression'

export interface TallyItem {
  /** Stable across aggregations: seal+class for DLC items, `book:<skill>` for skill books. */
  id: string
  /** Icon-manifest key; null when the manifest has no icon, so the name shows instead. */
  key: string | null
  name: string
  count: number
}

interface UnitTally {
  progression: Progression
  books: readonly number[]
}

const SEAL_LABEL: Record<ReclassSeal, string> = {
  master: 'Master Seal',
  heart: 'Heart Seal',
  partner: 'Partner Seal',
  friendship: 'Friendship Seal',
  dlc: 'DLC',
}

const SEAL_ORDER: SealUse['seal'][] = ['master', 'heart', 'partner', 'friendship', 'dlc', 'eternal']

/** Seals, class items and skill books the plans use, summed per item and in seal order, books last. */
export function tallyItems(dataset: Dataset, units: readonly UnitTally[]): TallyItem[] {
  const seals = new Map<string, { use: SealUse; count: number }>()
  const books = new Map<number, number>()
  for (const unit of units) {
    for (const use of sealsUsed(unit.progression)) {
      const id = `${use.seal}:${use.classId}`
      const entry = seals.get(id)
      if (entry) entry.count += use.count
      else seals.set(id, { use, count: use.count })
    }
    for (const skillId of unit.books) books.set(skillId, (books.get(skillId) ?? 0) + 1)
  }
  const order = (use: SealUse): [number, number] => [SEAL_ORDER.indexOf(use.seal), use.classId ?? 0]
  return [
    ...[...seals.values()]
      .sort((a, b) => {
        const [sealA, classA] = order(a.use)
        const [sealB, classB] = order(b.use)
        return sealA - sealB || classA - classB
      })
      .map(({ use, count }): TallyItem => {
        const key = use.seal === 'dlc' && use.classId !== null ? classItemKey(dataset, use.classId) ?? null : sealItemKey(use.seal) ?? null
        return {
          id: `${use.seal}:${use.classId}`,
          key,
          name: key ? itemName(key) : SEAL_LABEL[use.seal as ReclassSeal] ?? 'Seal',
          count,
        }
      }),
    ...[...books].map(([skillId, count]): TallyItem => {
      const key = bookItemKey(skillId) ?? null
      return { id: `book:${skillId}`, key, name: `${dataset.skillsById.get(skillId)?.name ?? '?'} skill book`, count }
    }),
  ]
}

/** The Chart's pill: every planned unit's path, each with the skill books its path doesn't teach. */
export function runTallyItems(dataset: Dataset, run: RunPlan, contexts: readonly UnitContext[]): TallyItem[] {
  return tallyItems(dataset, contexts.map((ctx) => {
    const progression = buildProgression(dataset, run, ctx)
    return { progression, books: skillBooksUsed(run, ctx, learnedSkillIds(progression)) }
  }))
}
