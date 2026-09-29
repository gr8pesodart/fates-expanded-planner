import { useMemo } from 'react'
import type { Dataset, UnitDef } from '../data/types'
import { edgePartner, supportPartners } from '../data/types'
import type { UnitContext } from '../logic/army'
import { armyUnits, displayName, unitContext } from '../logic/army'
import { classFamily, classPool } from '../logic/classes'
import type { LensId } from '../logic/lenses'
import { lensRow } from '../logic/lenses'
import type { RosterSort, RosterSortEntry } from '../logic/rosterSort'
import { reconcileRosterSort, sortRoster } from '../logic/rosterSort'
import type { SlotKind } from '../components/slots'
import type { RunPlan } from '../state/model'
import { fixedParentIsCorrin } from '../logic/stats'
import { usePlanner } from './plannerContext'

export interface RosterEntry extends RosterSortEntry {
  ctx: UnitContext
}

export function recruitIndex(dataset: Dataset, run: RunPlan, unit: UnitDef): number {
  return dataset.recruitment?.[run.route]?.get(unit.id)?.order ?? 1000 + unit.slot
}

export function rosterEntries(dataset: Dataset, run: RunPlan, lens: LensId): RosterEntry[] {
  return armyUnits(dataset, run).flatMap((unit) => {
    const ctx = unitContext(dataset, run, unit.id)
    if (!ctx) return []
    return [{
      unitId: unit.id,
      name: displayName(unit),
      favourite: run.favourites.includes(unit.id),
      recruitIndex: recruitIndex(dataset, run, unit),
      fixedParent: unit.fixedParent,
      lensRow: lensRow(dataset, run, ctx, lens),
      ctx,
    }]
  })
}

export function useSortedRoster(lens: LensId, sort: RosterSort): { entries: RosterEntry[]; sort: RosterSort } {
  const { dataset, run } = usePlanner()
  return useMemo(() => {
    const entries = rosterEntries(dataset, run, lens)
    const effective = reconcileRosterSort(sort, entries)
    return { entries: sortRoster(entries, effective) as RosterEntry[], sort: effective }
  }, [dataset, run, lens, sort])
}

export interface Candidate {
  unit: UnitDef
  name: string
  /** Current holder of this bond with someone else (picking them unlinks it). */
  takenBy: string | null
  fast: boolean
  /** Class the Partner/Friendship Seal grants the chooser (S / A+ only). */
  gains: string | null
}

function sealBranchName(dataset: Dataset, run: RunPlan, owner: UnitDef, donor: UnitDef, kind: 'seal' | 'aplus'): string | null {
  const pool = classPool(dataset, owner, {
    sPartner: kind === 'seal' ? donor : null,
    aPlusPartner: kind === 'aplus' ? donor : null,
    corrinTalentClassId: run.corrin.talentClassId,
    fixedParentIsCorrin: fixedParentIsCorrin(dataset, owner),
  })
  const entry = pool.find((item) => item.branch === kind)
  const def = entry ? dataset.classesById.get(entry.classId) : undefined
  return def ? classFamily(def.name) : null
}

/** Who can fill a relationship slot, per the build's support graph (pair-up is open to anyone). */
export function candidatesFor(dataset: Dataset, run: RunPlan, ownerId: string, kind: SlotKind): Candidate[] {
  const army = armyUnits(dataset, run)
  const inArmy = new Set(army.map((unit) => unit.id))
  const owner = dataset.unitsById.get(ownerId)
  if (!owner) return []
  const subjectId = kind === 'parent' ? owner.fixedParent : ownerId
  if (!subjectId) return []
  const subject = dataset.unitsById.get(subjectId)!
  const bond = kind === 'a' ? 'aPlusPartner' : kind === 'pair' ? 'pairPartner' : 'sPartner'

  let pool: { id: string; fast: boolean }[]
  if (kind === 'pair') {
    pool = army.filter((unit) => unit.id !== ownerId).map((unit) => ({ id: unit.id, fast: false }))
  } else {
    const edges = supportPartners(dataset, subjectId, kind === 'a' ? 'platonic' : 'romantic')
      .filter((edge) => kind !== 'a' || edge.info.ranks.a !== null)
    pool = edges.map((edge) => ({ id: edgePartner(edge, subjectId), fast: edge.info.fast }))
  }

  return pool
    .filter((item) => inArmy.has(item.id))
    .flatMap(({ id, fast }) => {
      const unit = dataset.unitsById.get(id)
      if (!unit) return []
      const holder = run.units[id]?.[bond]
      const takenBy = holder && holder !== subjectId ? displayName(dataset.unitsById.get(holder) ?? unit) : null
      const gains = kind === 's' || kind === 'a' ? sealBranchName(dataset, run, subject, unit, kind === 's' ? 'seal' : 'aplus') : null
      return [{ unit, name: displayName(unit), takenBy, fast, gains }]
    })
    .sort((a, b) => recruitIndex(dataset, run, a.unit) - recruitIndex(dataset, run, b.unit))
}
