import { assetUrl } from '../data/assets'
import { BOONS, BANES } from '../data/boons'
import { getBuildProfile } from '../data/modProfiles'
import { useDataset } from '../data/useDataset'
import {
  ROUTES,
  STAT_KEYS,
  className as datasetClassName,
  skillName as datasetSkillName,
  unitName as datasetUnitName,
} from '../data/types'
import type { Dataset, DatasetEdge, Route, StatKey, UnitDef } from '../data/types'
import { childrenOfPair } from '../logic/family'
import { classFamily, classPool, ownBaseClasses, primaryBaseClass, sexedClassId } from '../logic/classes'
import { projectUnit } from '../logic/stats'
import { navigate } from '../lib/router'
import { emptyUnitPlan } from '../state/model'
import type { RunPlan, UnitPlan } from '../state/model'
import { usePlansStore } from '../state/store'
import { usePlannerUiStore } from '../state/uiStore'
import type { PartnerRank } from '../state/uiStore'
import type {
  CompareColumnVM,
  CompareTrayVM,
  ConflictVM,
  PairCardVM,
  PairingsVM,
  PartnerOptionVM,
} from './types'
import type { CorrinCardVM, PartnerSheetVM, RunPillVM, SpriteVM, TalentSheetVM, UnitSummaryVM } from './types'

const SORT_OPTIONS: { id: string; label: string; stat: StatKey | 'name' }[] = [
  { id: 'spd', label: 'Spd', stat: 'spd' },
  { id: 'str', label: 'Str', stat: 'str' },
  { id: 'mag', label: 'Mag', stat: 'mag' },
  { id: 'skl', label: 'Skl', stat: 'skl' },
  { id: 'def', label: 'Def', stat: 'def' },
  { id: 'res', label: 'Res', stat: 'res' },
  { id: 'name', label: 'Name', stat: 'name' },
]

const FILTERS: { id: string; label: string; warn?: boolean }[] = [
  { id: 'all', label: 'All' },
  { id: 'unpaired', label: 'Unpaired' },
  { id: 'children', label: 'Children' },
  { id: 'magic', label: 'Magic' },
  { id: 'conflicts', label: 'Conflicts', warn: true },
]

const NON_TALENT_CLASSES = new Set(['Nohr Prince', 'Nohr Princess', 'Songstress', 'Wolfskin', 'Kitsune', 'Villager'])

interface PairModel {
  id: string
  a: UnitDef
  b: UnitDef
  child: UnitDef | null
  variableParent: UnitDef | null
}

interface ConflictModel {
  id: string
  message: string
  unitIds: string[]
}

function activeRunFrom(runs: RunPlan[], activeRunId: string): RunPlan | undefined {
  return runs.find((run) => run.id === activeRunId) ?? runs[0]
}

function runById(runs: RunPlan[], runId: string): RunPlan | undefined {
  return runs.find((run) => run.id === runId)
}

function spriteFor(unit: UnitDef): SpriteVM {
  return { label: unit.name, src: assetUrl('unit', unit.id) }
}

function runPillFor(run: RunPlan): RunPillVM {
  const profile = getBuildProfile(run.modpackId)
  const route = ROUTES.find((entry) => entry.id === run.route) ?? ROUTES[2]
  const runName = run.name.trim() || 'New run'
  return {
    runName: run.name,
    crest: runName.charAt(0).toUpperCase(),
    modpackLabel: profile.short,
    dlc: run.dlc,
    route: route.id,
    routeLabel: route.label,
    onOpenRuns: () => navigate({ name: 'setup' }),
    onOpenSetup: () => navigate({ name: 'setup' }),
  }
}

function corrinFor(dataset: Dataset, gender: 'male' | 'female'): UnitDef | undefined {
  return dataset.units.find((unit) => unit.isCorrin && unit.gender === gender)
}

function edgeBetween(dataset: Dataset, a: string, b: string): DatasetEdge | undefined {
  return (dataset.edgesByCharacter.get(a) ?? []).find((edge) => edge.a === b || edge.b === b)
}

function isRouteAvailable(unit: UnitDef, run: RunPlan): boolean {
  return unit.routes.includes(run.route) && (run.dlc || !unit.dlc)
}

function rosterUnits(dataset: Dataset, run: RunPlan): UnitDef[] {
  const corrin = corrinFor(dataset, run.corrin.gender)
  return dataset.units.filter((unit) => {
    if (!isRouteAvailable(unit, run)) return false
    if (unit.isCorrin && unit.id !== corrin?.id) return false
    if (unit.fixedParent && dataset.unitsById.get(unit.fixedParent)?.isCorrin && unit.fixedParent !== corrin?.id) return false
    return unit.isCorrin || (run.units[unit.id]?.inArmy ?? true)
  })
}

function unitPlan(run: RunPlan, unitId: string): UnitPlan {
  return run.units[unitId] ?? emptyUnitPlan()
}

function partnerFor(plan: UnitPlan, rank: 'S' | 'A+'): string | undefined {
  return rank === 'S' ? plan.sPartner : plan.aPlusPartner
}

function variableParentIdFor(dataset: Dataset, unit: UnitDef, run: RunPlan): string | undefined {
  const saved = run.units[unit.id]?.variableParent
  const savedUnit = saved ? dataset.unitsById.get(saved) : undefined
  if (savedUnit && isRouteAvailable(savedUnit, run)) return saved
  if (!unit.fixedParent) return undefined
  const fixedUnit = dataset.unitsById.get(unit.fixedParent)
  if (!fixedUnit) return undefined
  const fixedParent = run.units[unit.fixedParent]
  const partnerId = fixedParent?.sPartner
  const partner = partnerId ? dataset.unitsById.get(partnerId) : undefined
  const edge = partner ? edgeBetween(dataset, fixedUnit.id, partner.id) : undefined
  if (partner && isRouteAvailable(partner, run) && run.units[partner.id]?.sPartner === unit.fixedParent && edge && edge.info.ranks.s !== null) {
    return partner.id
  }
  return undefined
}

function projectionFor(dataset: Dataset, unit: UnitDef, run: RunPlan, variableParentId?: string) {
  return projectUnit(dataset, unit, undefined, {
    corrinBoon: run.corrin.boon,
    corrinBane: run.corrin.bane,
    variableParentId: variableParentId === undefined ? variableParentIdFor(dataset, unit, run) : variableParentId,
  })
}

function personalSkillId(unit: UnitDef, route: Route): number | null {
  return unit.personalSkills[route] ?? unit.personalSkills.revelation ?? unit.personalSkills.birthright ?? unit.personalSkills.conquest
}

function personalSkillName(dataset: Dataset, unit: UnitDef, route: Route): string {
  const skillId = personalSkillId(unit, route)
  return skillId === null ? '—' : datasetSkillName(dataset, skillId)
}

function bestStatIndex(growths: number[]): number {
  let best = 0
  for (let index = 1; index < growths.length; index += 1) {
    if (growths[index] > growths[best]) best = index
  }
  return best
}

function baseClasses(dataset: Dataset, unit: UnitDef, run: RunPlan): number[] {
  const ids = ownBaseClasses(dataset, unit)
  if (unit.isCorrin && run.corrin.talentClassId !== null) {
    const talent = sexedClassId(dataset, run.corrin.talentClassId, unit.gender)
    if (!ids.includes(talent)) ids.push(talent)
  }
  return ids.filter((id) => {
    const classDef = dataset.classesById.get(id)
    return classDef && (run.dlc || !classDef.dlc)
  })
}

function offerFor(dataset: Dataset, unit: UnitDef, run: RunPlan): { name: string; skill: string } {
  const offerId = unit.isCorrin && run.corrin.talentClassId !== null
    ? sexedClassId(dataset, run.corrin.talentClassId, unit.gender)
    : primaryBaseClass(dataset, unit)
  if (offerId === null) return { name: '—', skill: '—' }
  const offer = dataset.classesById.get(offerId)
  if (!offer || (offer.dlc && !run.dlc)) return { name: '—', skill: '—' }
  return {
    name: offer.name,
    skill: offer.skills.length > 0 ? datasetSkillName(dataset, offer.skills[0]) : '—',
  }
}

function conflictModels(dataset: Dataset, run: RunPlan, roster: UnitDef[]): ConflictModel[] {
  const conflicts: ConflictModel[] = []
  const rosterIds = new Set(roster.map((unit) => unit.id))
  const claims = new Map<string, string[]>()
  const seenPairs = new Set<string>()

  for (const unit of roster) {
    const plan = unitPlan(run, unit.id)
    for (const rank of ['S', 'A+'] as const) {
      const partnerId = partnerFor(plan, rank)
      if (!partnerId) continue
      const partner = dataset.unitsById.get(partnerId)
      const pairKey = `${rank}:${[unit.id, partnerId].sort().join('|')}`
      if (partnerId !== unit.id && !seenPairs.has(pairKey)) {
        const reciprocal = partner ? partnerFor(unitPlan(run, partnerId), rank) : undefined
        if (reciprocal !== unit.id) {
          conflicts.push({
            id: `onesided-${rank}-${unit.id}-${partnerId}`,
            unitIds: [unit.id, partnerId],
            message: `${unit.name} lists ${datasetUnitName(dataset, partnerId)} as ${rank}, but ${datasetUnitName(dataset, partnerId)} has not picked them back.`,
          })
        }
        seenPairs.add(pairKey)
      }

      const claimKey = `${rank}:${partnerId}`
      claims.set(claimKey, [...(claims.get(claimKey) ?? []), unit.id])

      const edge = partner ? edgeBetween(dataset, unit.id, partnerId) : undefined
      const allowed = rank === 'S'
        ? edge !== undefined && edge.info.ranks.s !== null
        : edge !== undefined && edge.info.ranks.a !== null && unit.gender === partner?.gender
      const routeLabel = ROUTES.find((route) => route.id === run.route)?.label ?? run.route
      if (!partner || !rosterIds.has(partnerId) || !allowed) {
        conflicts.push({
          id: `invalid-${rank}-${unit.id}-${partnerId}`,
          unitIds: [unit.id, partnerId],
          message: `${unit.name}'s ${rank} partner ${datasetUnitName(dataset, partnerId)} is unavailable for ${routeLabel} or is not allowed by this build's support graph.`,
        })
      }
    }
  }

  for (const [key, claimants] of claims) {
    if (claimants.length < 2) continue
    const [rank, partnerId] = key.split(':') as ['S' | 'A+', string]
    const label = claimants.map((id) => datasetUnitName(dataset, id)).join(' and ')
    conflicts.push({
      id: `claimed-${key}`,
      unitIds: [partnerId, ...claimants],
      message: `${datasetUnitName(dataset, partnerId)} is claimed as ${rank} by ${label}.`,
    })
  }

  for (const child of roster) {
    if (!child.fixedParent) continue
    const fixedParent = dataset.unitsById.get(child.fixedParent)
    if (!fixedParent) continue
    const fixedPlan = unitPlan(run, fixedParent.id)
    const inferredParent = fixedPlan.sPartner && unitPlan(run, fixedPlan.sPartner).sPartner === fixedParent.id
      ? fixedPlan.sPartner
      : undefined
    const savedParent = run.units[child.id]?.variableParent
    if (inferredParent && !savedParent) {
      conflicts.push({
        id: `unset-parent-${child.id}`,
        unitIds: [child.id, fixedParent.id, inferredParent],
        message: `${child.name}'s variable parent is not saved, although ${fixedParent.name} has an S partner.`,
      })
    } else if (savedParent) {
      const parent = dataset.unitsById.get(savedParent)
      const edge = edgeBetween(dataset, fixedParent.id, savedParent)
      if (!parent || !isRouteAvailable(parent, run) || !edge || edge.info.ranks.s === null) {
        conflicts.push({
          id: `invalid-parent-${child.id}`,
          unitIds: [child.id, fixedParent.id, savedParent],
          message: `${child.name}'s selected variable parent is not a valid S-support partner of ${fixedParent.name} in this run.`,
        })
      }
    }
  }

  const deduped = new Map<string, ConflictModel>()
  for (const conflict of conflicts) {
    const key = `${conflict.id}:${[...conflict.unitIds].sort().join('|')}`
    if (!deduped.has(key)) deduped.set(key, conflict)
  }
  return [...deduped.values()]
}

function pairedUnits(dataset: Dataset, run: RunPlan, roster: UnitDef[]): PairModel[] {
  const byId = new Map(roster.map((unit) => [unit.id, unit]))
  const pairs: PairModel[] = []
  const seen = new Set<string>()
  for (const unit of roster) {
    const partnerId = run.units[unit.id]?.sPartner
    if (!partnerId || run.units[partnerId]?.sPartner !== unit.id) continue
    const partner = byId.get(partnerId)
    if (!partner) continue
    const key = [unit.id, partnerId].sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    const a = unit.id.localeCompare(partner.id) <= 0 ? unit : partner
    const b = a.id === unit.id ? partner : unit
    const children = childrenOfPair(dataset, a.id, b.id).filter((child) => isRouteAvailable(child, run) && byId.has(child.id))
    const corrinChild = children.find((child) => dataset.unitsById.get(child.fixedParent ?? '')?.isCorrin)
    const child = corrinChild ?? children[0] ?? null
    const variableParentId = child
      ? child.fixedParent === a.id ? b.id : child.fixedParent === b.id ? a.id : undefined
      : undefined
    pairs.push({
      id: `pair-${key}`,
      a,
      b,
      child,
      variableParent: variableParentId ? dataset.unitsById.get(variableParentId) ?? null : null,
    })
  }
  return pairs
}

function inheritedClassName(dataset: Dataset, child: UnitDef, variableParent: UnitDef | null, run: RunPlan): string {
  if (!variableParent) return '—'
  const fixedParent = child.fixedParent ? dataset.unitsById.get(child.fixedParent) : undefined
  const pool = classPool(dataset, child, {
    variableParent,
    corrinTalentClassId: run.corrin.talentClassId,
    fixedParentIsCorrin: fixedParent?.isCorrin,
  })
  const inherited = pool.find((entry) => entry.branch === 'parent' && entry.sourceLabel === `Parent: ${variableParent.name}`)
  const inheritedClass = inherited ? dataset.classesById.get(inherited.classId) : undefined
  return inheritedClass && (run.dlc || !inheritedClass.dlc) ? inheritedClass.name : '—'
}

function childGrowths(dataset: Dataset, child: UnitDef, variableParent: UnitDef | null, run: RunPlan): number[] {
  return projectUnit(dataset, child, undefined, {
    corrinBoon: run.corrin.boon,
    corrinBane: run.corrin.bane,
    variableParentId: variableParent?.id ?? null,
  }).growths
}

function currentVariableParent(dataset: Dataset, unit: UnitDef, run: RunPlan): UnitDef | null {
  const id = variableParentIdFor(dataset, unit, run)
  return id ? dataset.unitsById.get(id) ?? null : null
}

function clearField(runId: string, unitId: string, rank: 'S' | 'A+'): void {
  const { updateUnit } = usePlansStore.getState()
  updateUnit(runId, unitId, (plan) => rank === 'S'
    ? { ...plan, sPartner: undefined }
    : { ...plan, aPlusPartner: undefined })
}

function clearParticipant(runId: string, unitId: string, rank: 'S' | 'A+'): void {
  const state = usePlansStore.getState()
  const run = runById(state.runs, runId)
  const previous = run ? partnerFor(unitPlan(run, unitId), rank) : undefined
  clearField(runId, unitId, rank)
  if (!previous || previous === unitId) return
  const updatedState = usePlansStore.getState()
  const updatedRun = runById(updatedState.runs, runId)
  if (updatedRun && partnerFor(unitPlan(updatedRun, previous), rank) === unitId) clearField(runId, previous, rank)
}

function setSymmetricPartner(
  runId: string,
  dataset: Dataset,
  unitId: string,
  rank: 'S' | 'A+',
  partnerId: string | null,
): void {
  const firstState = usePlansStore.getState()
  const firstRun = runById(firstState.runs, runId)
  if (!firstRun) return
  const oldA = partnerFor(unitPlan(firstRun, unitId), rank)
  const oldB = partnerId ? partnerFor(unitPlan(firstRun, partnerId), rank) : undefined
  const formerPairs = new Map<string, [string, string]>()
  if (rank === 'S') {
    if (oldA && oldA !== unitId && oldA !== partnerId) {
      const key = [unitId, oldA].sort().join('|')
      formerPairs.set(key, [unitId, oldA])
    }
    if (partnerId && oldB && oldB !== partnerId && oldB !== unitId) {
      const key = [partnerId, oldB].sort().join('|')
      formerPairs.set(key, [partnerId, oldB])
    }
  }

  clearParticipant(runId, unitId, rank)
  if (partnerId && partnerId !== unitId) clearParticipant(runId, partnerId, rank)
  if (partnerId && partnerId !== unitId) {
    const { updateUnit } = usePlansStore.getState()
    updateUnit(runId, unitId, (plan) => rank === 'S'
      ? { ...plan, sPartner: partnerId }
      : { ...plan, aPlusPartner: partnerId })
    updateUnit(runId, partnerId, (plan) => rank === 'S'
      ? { ...plan, sPartner: unitId }
      : { ...plan, aPlusPartner: unitId })
  }

  if (rank === 'S') {
    const { updateUnit } = usePlansStore.getState()
    for (const [a, b] of formerPairs.values()) {
      if (!a || !b) continue
      for (const child of childrenOfPair(dataset, a, b)) {
        const expectedParent = child.fixedParent === a ? b : a
        updateUnit(runId, child.id, (plan) => plan.variableParent === expectedParent
          ? { ...plan, variableParent: undefined }
          : plan)
      }
    }
    if (partnerId && partnerId !== unitId) {
      for (const child of childrenOfPair(dataset, unitId, partnerId)) {
        const variableParentId = child.fixedParent === unitId ? partnerId : unitId
        updateUnit(runId, child.id, (plan) => ({ ...plan, variableParent: variableParentId }))
      }
    }
  }
}

function partnerAllowed(dataset: Dataset, run: RunPlan, unit: UnitDef, partner: UnitDef, rank: 'S' | 'A+'): boolean {
  if (unit.id === partner.id || !isRouteAvailable(partner, run)) return false
  const edge = edgeBetween(dataset, unit.id, partner.id)
  if (!edge) return false
  if (rank === 'S') return edge.info.ranks.s !== null
  return edge.info.ranks.a !== null && unit.gender === partner.gender
}

function candidatePartnerUnits(dataset: Dataset, run: RunPlan, sheetUnit: UnitDef, rank: PartnerRank, roster: UnitDef[]): UnitDef[] {
  if (rank === 'Parent') {
    const fixedParent = sheetUnit.fixedParent ? dataset.unitsById.get(sheetUnit.fixedParent) : undefined
    if (!fixedParent) return []
    return roster.filter((partner) => partnerAllowed(dataset, run, fixedParent, partner, 'S'))
  }
  return roster.filter((partner) => partnerAllowed(dataset, run, sheetUnit, partner, rank))
}

function partnerSheetFor(
  dataset: Dataset,
  run: RunPlan,
  roster: UnitDef[],
  sheet: ReturnType<typeof usePlannerUiStore.getState>['partnerSheet'],
): PartnerSheetVM | null {
  if (!sheet) return null
  const unit = dataset.unitsById.get(sheet.unitId)
  if (!unit) return null
  const plan = unitPlan(run, unit.id)
  const selected = sheet.rank === 'Parent' ? plan.variableParent : partnerFor(plan, sheet.rank)
  const options: PartnerOptionVM[] = candidatePartnerUnits(dataset, run, unit, sheet.rank, roster)
    .map((partner) => {
      const edge = edgeBetween(dataset, sheet.rank === 'Parent' ? unit.fixedParent ?? unit.id : unit.id, partner.id)
      return {
        id: partner.id,
        name: partner.name,
        sprite: spriteFor(partner),
        romantic: edge?.info.kind === 'romantic',
        fast: edge?.info.fast ?? false,
        hasS: edge?.info.ranks.s !== null && edge !== undefined,
        hasA: edge?.info.ranks.a !== null && edge !== undefined,
        current: selected === partner.id ? (sheet.rank === 'Parent' ? 'S' : sheet.rank) : null,
        onPick: () => {
          if (sheet.rank === 'Parent') {
            usePlansStore.getState().updateUnit(run.id, unit.id, (current) => ({ ...current, variableParent: partner.id }))
          } else {
            setSymmetricPartner(run.id, dataset, unit.id, sheet.rank, partner.id)
          }
          usePlannerUiStore.getState().closePartnerSheet()
        },
      }
    })
    .sort((a, b) => {
      if (a.current && !b.current) return -1
      if (b.current && !a.current) return 1
      const score = (option: PartnerOptionVM) => (option.romantic ? 2 : 0) + (option.hasS ? 1 : 0) + (option.fast ? 0.5 : 0)
      return score(b) - score(a) || a.name.localeCompare(b.name)
    })
  return {
    unitId: unit.id,
    unitName: unit.name,
    rank: sheet.rank,
    options,
    onClose: () => usePlannerUiStore.getState().closePartnerSheet(),
    onClear: () => {
      if (sheet.rank === 'Parent') {
        usePlansStore.getState().updateUnit(run.id, unit.id, (current) => ({ ...current, variableParent: undefined }))
      } else {
        setSymmetricPartner(run.id, dataset, unit.id, sheet.rank, null)
      }
      usePlannerUiStore.getState().closePartnerSheet()
    },
  }
}

function talentSheetFor(dataset: Dataset, run: RunPlan, open: boolean): TalentSheetVM | null {
  if (!open) return null
  const candidates = new Map<number, string>()
  for (const gameClass of dataset.classes) {
    if (gameClass.tier !== 'base' || (gameClass.dlc && !run.dlc)) continue
    const family = classFamily(gameClass.name)
    if (NON_TALENT_CLASSES.has(family)) continue
    const classId = sexedClassId(dataset, gameClass.id, run.corrin.gender)
    const classDef = dataset.classesById.get(classId)
    if (classDef) candidates.set(classId, classDef.name)
  }
  const currentId = run.corrin.talentClassId === null
    ? null
    : sexedClassId(dataset, run.corrin.talentClassId, run.corrin.gender)
  const options = [...candidates]
    .map(([classId, name]) => ({
      classId,
      name,
      sprite: { label: name, src: assetUrl('class', classId) },
      current: classId === currentId,
      onPick: () => {
        usePlansStore.getState().updateRun(run.id, { corrin: { talentClassId: classId } })
        usePlannerUiStore.getState().setTalentSheet(false)
      },
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { options, onClose: () => usePlannerUiStore.getState().setTalentSheet(false) }
}

function corrinCardFor(dataset: Dataset, run: RunPlan): CorrinCardVM | null {
  const corrin = corrinFor(dataset, run.corrin.gender)
  if (!corrin || !isRouteAvailable(corrin, run)) return null
  const spouseId = run.units[corrin.id]?.sPartner
  const kana = dataset.units.find((unit) => unit.fixedParent === corrin.id)
  const talentId = run.corrin.talentClassId === null
    ? null
    : sexedClassId(dataset, run.corrin.talentClassId, run.corrin.gender)
  return {
    unitId: corrin.id,
    name: corrin.name,
    sprite: spriteFor(corrin),
    gender: run.corrin.gender,
    onSetGender: (gender) => {
      if (gender === run.corrin.gender) return
      const state = usePlansStore.getState()
      const latestRun = activeRunFrom(state.runs, state.activeRunId)
      if (!latestRun) return
      const oldCorrin = corrinFor(dataset, latestRun.corrin.gender)
      const nextCorrin = corrinFor(dataset, gender)
      const oldSpouse = oldCorrin ? latestRun.units[oldCorrin.id]?.sPartner ?? null : null
      const nextTalent = latestRun.corrin.talentClassId === null || !nextCorrin
        ? latestRun.corrin.talentClassId
        : sexedClassId(dataset, latestRun.corrin.talentClassId, gender)
      state.updateRun(latestRun.id, { corrin: { gender, talentClassId: nextTalent } })
      if (oldCorrin) setSymmetricPartner(latestRun.id, dataset, oldCorrin.id, 'S', null)
      const spouse = oldSpouse ? dataset.unitsById.get(oldSpouse) : undefined
      if (nextCorrin && spouse && partnerAllowed(dataset, { ...latestRun, corrin: { ...latestRun.corrin, gender } }, nextCorrin, spouse, 'S')) {
        setSymmetricPartner(latestRun.id, dataset, nextCorrin.id, 'S', spouse.id)
      }
    },
    boons: STAT_KEYS.map((key) => ({
      key,
      label: BOONS[key].label,
      active: run.corrin.boon === key,
      onSelect: () => usePlansStore.getState().updateRun(run.id, { corrin: { boon: key } }),
    })),
    banes: STAT_KEYS.map((key) => ({
      key,
      label: BANES[key].label,
      active: run.corrin.bane === key,
      onSelect: () => usePlansStore.getState().updateRun(run.id, { corrin: { bane: key } }),
    })),
    talent: talentId === null ? 'unset' : datasetClassName(dataset, talentId),
    spouse: spouseId ? datasetUnitName(dataset, spouseId) : 'unset',
    childName: kana?.name ?? (run.corrin.gender === 'male' ? 'Kana (F)' : 'Kana (M)'),
    onOpenTalent: () => usePlannerUiStore.getState().setTalentSheet(true),
    onOpenSpouse: () => usePlannerUiStore.getState().openPartnerSheet(corrin.id, 'S'),
  }
}

export function usePairingsVM(): PairingsVM {
  const plans = usePlansStore()
  const ui = usePlannerUiStore()
  const activeRun = activeRunFrom(plans.runs, plans.activeRunId)
  const profile = getBuildProfile(activeRun?.modpackId ?? 'ugf-2.5.2')
  const { data } = useDataset(profile.packId)

  if (!activeRun || !data) {
    return {
      runPill: runPillFor(activeRun ?? {
        id: '', name: 'New run', modpackId: 'ugf-2.5.2', dlc: true, route: 'revelation',
        corrin: { gender: 'male', boon: 'str', bane: 'lck', talentClassId: null }, units: {}, createdAt: '', updatedAt: '',
      }),
      query: ui.query,
      onSearch: (query) => usePlannerUiStore.getState().setQuery(query),
      sortLabel: `${SORT_OPTIONS.find((sort) => sort.id === ui.sortId)?.label ?? 'Spd'} ↓`,
      sorts: SORT_OPTIONS.map((sort) => ({ id: sort.id, label: sort.label, active: ui.sortId === sort.id, onSelect: () => usePlannerUiStore.getState().setSort(sort.id) })),
      filters: FILTERS.map((filter) => ({ id: filter.id, label: filter.label, count: 0, warn: Boolean(filter.warn), active: ui.filterId === filter.id, onSelect: () => usePlannerUiStore.getState().setFilter(filter.id) })),
      units: [], totalCount: 0, empty: 'roster', onClearFilters: () => {
        usePlannerUiStore.getState().setQuery('')
        usePlannerUiStore.getState().setFilter('all')
      }, tray: null, pairCards: [], conflicts: [], corrin: null, dlc: activeRun?.dlc ?? true,
      partnerSheet: null, talentSheet: null,
      onOpenRuns: () => navigate({ name: 'setup' }), onOpenSetup: () => navigate({ name: 'setup' }),
    }
  }

  const roster = rosterUnits(data, activeRun)
  const rosterIds = new Set(roster.map((unit) => unit.id))
  const conflicts = conflictModels(data, activeRun, roster)
  const conflictByUnit = new Map<string, string>()
  for (const conflict of conflicts) {
    for (const id of conflict.unitIds) if (!conflictByUnit.has(id)) conflictByUnit.set(id, conflict.message)
  }
  const pairModels = pairedUnits(data, activeRun, roster)
  const summaries = new Map<string, UnitSummaryVM>()
  for (const unit of roster) {
    const plan = unitPlan(activeRun, unit.id)
    const projection = projectionFor(data, unit, activeRun)
    const classChips = baseClasses(data, unit, activeRun).slice(0, 2).map((id) => datasetClassName(data, id))
    summaries.set(unit.id, {
      id: unit.id,
      name: unit.name,
      sprite: spriteFor(unit),
      classChips,
      personalSkill: personalSkillName(data, unit, activeRun.route),
      growths: projection.growths,
      bestStatIndex: bestStatIndex(projection.growths),
      capMods: projection.caps,
      pinned: ui.pinnedIds.includes(unit.id),
      rank: plan.sPartner ? 'S' : plan.aPlusPartner ? 'A+' : null,
      conflict: conflictByUnit.get(unit.id),
      onOpen: () => navigate({ name: 'unit', unitId: unit.id }),
      onTogglePin: () => usePlannerUiStore.getState().togglePin(unit.id),
    })
  }

  const query = ui.query.trim().toLocaleLowerCase()
  const matching = roster.filter((unit) => {
    if (!query) return true
    const plan = unitPlan(activeRun, unit.id)
    const pool = classPool(data, unit, {
      variableParent: currentVariableParent(data, unit, activeRun),
      sPartner: plan.sPartner ? data.unitsById.get(plan.sPartner) : undefined,
      aPlusPartner: plan.aPlusPartner ? data.unitsById.get(plan.aPlusPartner) : undefined,
      corrinTalentClassId: activeRun.corrin.talentClassId,
      fixedParentIsCorrin: Boolean(unit.fixedParent && data.unitsById.get(unit.fixedParent)?.isCorrin),
    })
    const searchable = [
      unit.name,
      personalSkillName(data, unit, activeRun.route),
      ...pool.map((entry) => datasetClassName(data, entry.classId)),
    ].join(' ').toLocaleLowerCase()
    return searchable.includes(query)
  })

  const matchesFilter = (unit: UnitDef, filterId: string): boolean => {
    const plan = unitPlan(activeRun, unit.id)
    if (filterId === 'unpaired') return !plan.sPartner && !plan.aPlusPartner && !plan.combatPartner
    if (filterId === 'children') return Boolean(unit.fixedParent)
    if (filterId === 'magic') return (summaries.get(unit.id)?.growths[2] ?? 0) >= 30
    if (filterId === 'conflicts') return conflictByUnit.has(unit.id)
    return true
  }

  const filtered = matching.filter((unit) => matchesFilter(unit, ui.filterId))
  const sort = SORT_OPTIONS.find((option) => option.id === ui.sortId) ?? SORT_OPTIONS[0]
  const visible = [...filtered].sort((a, b) => {
    if (sort.stat === 'name') return a.name.localeCompare(b.name)
    const index = STAT_KEYS.indexOf(sort.stat)
    const left = summaries.get(a.id)?.growths[index] ?? 0
    const right = summaries.get(b.id)?.growths[index] ?? 0
    return right - left || a.name.localeCompare(b.name)
  })

  const filterCount = (id: string) => roster.filter((unit) => matchesFilter(unit, id)).length
  const filters = FILTERS.map((filter) => ({
    id: filter.id,
    label: filter.label,
    count: filter.id === 'conflicts' ? conflicts.length : filterCount(filter.id),
    warn: Boolean(filter.warn),
    active: ui.filterId === filter.id,
    onSelect: () => usePlannerUiStore.getState().setFilter(filter.id),
  }))
  const visibleSummaries = visible.map((unit) => summaries.get(unit.id)).filter((item): item is UnitSummaryVM => Boolean(item))

  const pinnedUnits = ui.pinnedIds.map((id) => data.unitsById.get(id)).filter((unit): unit is UnitDef => Boolean(unit && rosterIds.has(unit.id)))
  const columns: CompareColumnVM[] = pinnedUnits.map((unit) => {
    const offer = offerFor(data, unit, activeRun)
    return {
      id: unit.id,
      name: unit.name,
      sprite: spriteFor(unit),
      growths: projectionFor(data, unit, activeRun).growths,
      offer: offer.name,
      offerSkill: offer.skill,
      personalSkill: personalSkillName(data, unit, activeRun.route),
    }
  })
  const candidatePairs: { a: string; b: string }[] = pinnedUnits.length < 2 ? [] : [
    ...pairModels
      .filter((pair) => pinnedUnits.some((unit) => unit.id === pair.a.id) && pinnedUnits.some((unit) => unit.id === pair.b.id))
      .map((pair) => ({ a: pair.a.id, b: pair.b.id })),
    ...pinnedUnits.flatMap((a, index) => pinnedUnits.slice(index + 1).map((b) => ({ a: a.id, b: b.id }))),
  ]
  const comparePair = candidatePairs.find((pair) => {
    return childrenOfPair(data, pair.a, pair.b).some((child) => isRouteAvailable(child, activeRun) && rosterIds.has(child.id))
  })
  let trayChild: CompareTrayVM['child'] = null
  let childColumn: CompareColumnVM | null = null
  if (comparePair) {
    const a = data.unitsById.get(comparePair.a)
    const b = data.unitsById.get(comparePair.b)
    if (a && b) {
      const child = childrenOfPair(data, a.id, b.id).find((candidate) => isRouteAvailable(candidate, activeRun) && rosterIds.has(candidate.id))
      const variableParentId = child
        ? child.fixedParent === a.id ? b.id : child.fixedParent === b.id ? a.id : undefined
        : undefined
      const variableParent = variableParentId ? data.unitsById.get(variableParentId) ?? null : null
      if (child) {
        const growths = childGrowths(data, child, variableParent, activeRun)
        childColumn = {
          id: child.id,
          name: child.name,
          sprite: spriteFor(child),
          growths,
          offer: '—',
          offerSkill: '—',
          personalSkill: personalSkillName(data, child, activeRun.route),
          isChildPreview: true,
        }
        trayChild = {
          id: child.id,
          name: child.name,
          growths,
          inherits: inheritedClassName(data, child, variableParent, activeRun),
        }
      }
    }
  }
  const tray: CompareTrayVM | null = columns.length === 0 ? null : {
    columns: childColumn ? [...columns, childColumn] : columns,
    pinnedCount: columns.length,
    child: trayChild,
    onUnpin: (id) => usePlannerUiStore.getState().togglePin(id),
    onClear: () => usePlannerUiStore.getState().clearPins(),
    onOpenUnit: (id) => navigate({ name: 'unit', unitId: id }),
  }

  const pairCards: PairCardVM[] = pairModels.map((pair) => {
    const child = pair.child
    const childVm = child ? {
      id: child.id,
      name: child.name,
      sprite: spriteFor(child),
      inheritedClass: inheritedClassName(data, child, pair.variableParent, activeRun),
      growths: childGrowths(data, child, pair.variableParent, activeRun),
      conflict: conflictByUnit.get(child.id),
      onOpen: () => navigate({ name: 'unit', unitId: child.id }),
    } : null
    return {
      id: pair.id,
      a: {
        id: pair.a.id,
        name: pair.a.name,
        sprite: spriteFor(pair.a),
        onOpen: () => navigate({ name: 'unit', unitId: pair.a.id }),
        onOpenPartner: () => usePlannerUiStore.getState().openPartnerSheet(pair.a.id, 'S'),
      },
      b: {
        id: pair.b.id,
        name: pair.b.name,
        sprite: spriteFor(pair.b),
        onOpen: () => navigate({ name: 'unit', unitId: pair.b.id }),
        onOpenPartner: () => usePlannerUiStore.getState().openPartnerSheet(pair.b.id, 'S'),
      },
      child: childVm,
      onOpenUnit: (id) => navigate({ name: 'unit', unitId: id }),
    }
  })

  const conflictVMs: ConflictVM[] = conflicts.map((conflict) => ({
    id: conflict.id,
    message: conflict.message,
    onOpen: () => navigate({ name: 'unit', unitId: conflict.unitIds[0] }),
  }))
  const corrin = corrinCardFor(data, activeRun)
  const partnerSheet = partnerSheetFor(data, activeRun, roster, ui.partnerSheet)
  const talentSheet = talentSheetFor(data, activeRun, ui.talentSheet)

  return {
    runPill: runPillFor(activeRun),
    query: ui.query,
    onSearch: (query) => usePlannerUiStore.getState().setQuery(query),
    sortLabel: `${sort.label} ↓`,
    sorts: SORT_OPTIONS.map((option) => ({
      id: option.id,
      label: option.label,
      active: ui.sortId === option.id,
      onSelect: () => usePlannerUiStore.getState().setSort(option.id),
    })),
    filters,
    units: visibleSummaries,
    totalCount: roster.length,
    empty: visibleSummaries.length > 0 ? 'none' : query || ui.filterId !== 'all' ? 'filtered' : 'roster',
    onClearFilters: () => {
      usePlannerUiStore.getState().setQuery('')
      usePlannerUiStore.getState().setFilter('all')
    },
    tray,
    pairCards,
    conflicts: conflictVMs,
    corrin,
    dlc: activeRun.dlc,
    partnerSheet,
    talentSheet,
    onOpenRuns: () => navigate({ name: 'setup' }),
    onOpenSetup: () => navigate({ name: 'setup' }),
  }
}
