import { useMemo } from 'react'
import type { Dataset, UnitDef } from '../data/types'
import { edgePartner, supportPartners } from '../data/types'
import type { UnitContext } from '../logic/army'
import { aPlusEligible, armyUnits, displayName, recruitmentOf, unitContext } from '../logic/army'
import { classFamily, classPool } from '../logic/classes'
import type { LensId } from '../logic/lenses'
import { lensRow } from '../logic/lenses'
import { expectedFinal } from '../logic/progression'
import type { RosterSort, RosterSortEntry, SortOptions } from '../logic/rosterSort'
import { reconcileRosterSort, sortRoster } from '../logic/rosterSort'
import type { SlotKind } from '../components/slots'
import type { RunPlan } from '../state/model'
import { corrinBuild } from '../state/model'
import { fixedParentIsCorrin } from '../logic/stats'
import { usePlanner } from './plannerContext'

export interface RosterEntry extends RosterSortEntry {
  ctx: UnitContext
}

export function recruitIndex(dataset: Dataset, run: RunPlan, unit: UnitDef): number {
  return recruitmentOf(dataset, run, unit.id)?.order ?? 1000 + unit.slot
}

/**
 * Recruit order as the Roster shows it: every first-generation unit before any child. The raw
 * recruitment index puts paralogues just after Chapter 7, which would slot children mid-list.
 */
export function compareRecruitOrder(dataset: Dataset, run: RunPlan, a: UnitDef, b: UnitDef): number {
  const generation = Number(a.fixedParent !== null) - Number(b.fixedParent !== null)
  return generation || recruitIndex(dataset, run, a) - recruitIndex(dataset, run, b)
}

export function rosterEntries(dataset: Dataset, run: RunPlan, lens: LensId): RosterEntry[] {
  return armyUnits(dataset, run).flatMap((unit) => {
    const ctx = unitContext(dataset, run, unit.id)
    if (!ctx) return []
    const final = lens === 'expectedFinal' ? expectedFinal(dataset, run, ctx) : null
    return [{
      unitId: unit.id,
      name: displayName(unit, run),
      favourite: run.favourites.includes(unit.id),
      recruitIndex: recruitIndex(dataset, run, unit),
      fixedParent: unit.fixedParent,
      lensRow: final ? final.row : lensRow(dataset, run, ctx, lens),
      muted: final?.base ?? false,
      pairPartner: ctx.plan.pairPartner,
      pairRole: ctx.plan.pairRole ?? 'front',
      ctx,
    }]
  })
}

export function useSortedRoster(
  lens: LensId,
  sort: RosterSort,
  options: SortOptions = {},
): { entries: RosterEntry[]; sort: RosterSort } {
  const { dataset, run } = usePlanner()
  const { favouritesFirst, linkPairs, generation } = options
  return useMemo(() => {
    const entries = rosterEntries(dataset, run, lens)
    const effective = reconcileRosterSort(sort, entries)
    return { entries: sortRoster(entries, effective, { favouritesFirst, linkPairs, generation }) as RosterEntry[], sort: effective }
  }, [dataset, run, lens, sort, favouritesFirst, linkPairs, generation])
}

export interface Candidate {
  unit: UnitDef
  name: string
  /** Current holder of this bond with someone else (picking them unlinks it). */
  takenBy: string | null
  fast: boolean
  /** Class the Partner/Friendship Seal grants the chooser (S / A+ only). */
  gains: string | null
  rankBadge: 'S' | 'A+' | 'A' | null
}

function sealBranchName(dataset: Dataset, run: RunPlan, owner: UnitDef, donor: UnitDef, kind: 'seal' | 'aplus'): string | null {
  const pool = classPool(dataset, owner, {
    sPartner: kind === 'seal' ? donor : null,
    aPlusPartner: kind === 'aplus' ? donor : null,
    friendshipDonors: owner.isCorrin && kind === 'aplus' ? [donor] : undefined,
    corrinTalentClassId: corrinBuild(run).talentClassId,
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
    const edges = supportPartners(dataset, subjectId, kind === 'a' ? 'a-rank' : 'romantic')
      .filter((edge) => {
        if (kind !== 'a') return true
        const id = edgePartner(edge, subjectId)
        if (!subject.isCorrin) return aPlusEligible(dataset, subject, dataset.unitsById.get(id), run.units[subjectId]?.sPartner)
        // Corrin's S partner can't double as an A-rank Friendship Seal partner.
        return dataset.unitsById.get(id)?.gender === subject.gender && run.units[subjectId]?.sPartner !== id
      })
    pool = edges.map((edge) => ({ id: edgePartner(edge, subjectId), fast: edge.info.fast }))
  }

  return pool
    .filter((item) => inArmy.has(item.id))
    .flatMap(({ id, fast }) => {
      const unit = dataset.unitsById.get(id)
      if (!unit) return []
      const holder = run.units[id]?.[bond]
      const takenBy = holder && holder !== subjectId ? displayName(dataset.unitsById.get(holder) ?? unit, run) : null
      const gains = kind === 's' || kind === 'a' ? sealBranchName(dataset, run, subject, unit, kind === 's' ? 'seal' : 'aplus') : null
      const rankBadge: Candidate['rankBadge'] = kind === 'pair' && run.units[subjectId]?.sPartner === id ? 'S'
        : kind === 'pair' && run.units[subjectId]?.aPlusPartner === id ? 'A+'
          : kind === 'pair' && run.units[subjectId]?.friendshipPartners?.includes(id) ? 'A'
            : null
      return [{ unit, name: displayName(unit, run), takenBy: kind === 'a' ? null : takenBy, fast, gains, rankBadge }]
    })
    .sort((a, b) => {
      const rankOrder = (item: Candidate) => item.rankBadge === 'S' ? 0 : item.rankBadge ? 1 : 2
      const rankDiff = rankOrder(a) - rankOrder(b)
      if (rankDiff) return rankDiff
      return compareRecruitOrder(dataset, run, a.unit, b.unit)
    })
}
