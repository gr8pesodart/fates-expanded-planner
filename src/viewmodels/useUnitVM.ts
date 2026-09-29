import { assetUrl } from '../data/assets'
import { getBuildProfile } from '../data/modProfiles'
import { useDataset } from '../data/useDataset'
import {
  STAT_KEYS,
  STAT_LABELS,
  className as dataClassName,
  edgePartner,
  skillName,
  supportPartners,
} from '../data/types'
import type { Dataset, Route, UnitDef } from '../data/types'
import { usePlannerUiStore } from '../state/uiStore'
import { unitPlanFor } from '../state/model'
import type { RunPlan, UnitPlan } from '../state/model'
import { usePlansStore } from '../state/store'
import { classPool, baseOfClass, primaryBaseClass } from '../logic/classes'
import type { ClassPoolEntry } from '../logic/classes'
import { childrenOfPair } from '../logic/family'
import { pairUpBonus } from '../logic/pairUp'
import type { PairUpRank } from '../logic/pairUp'
import { fixedParentIsCorrin, projectUnit } from '../logic/stats'
import { skillPool } from '../logic/skills'
import { navigate } from '../lib/router'
import type {
  ClassSourceId,
  ClassCompareVM,
  ClassGroupVM,
  CombatSheetVM,
  InheritanceVM,
  PartnerOptionVM,
  PartnerSheetVM,
  SkillOptionVM,
  SkillPickerVM,
  UnitVM,
  WarningVM,
} from './types'

interface InheritedSkill {
  id: number
  parentId: string
}

interface ResolvedSkill extends SkillOptionVM {
  groupId: string
  groupLabel: string
}

function shortSkill(name: string): string {
  const words = name.split(/[\s'-]+/).filter(Boolean)
  if (words.length >= 2) return `${words[0][0].toUpperCase()}${words[1][0]}`
  return name.slice(0, 2).toUpperCase()
}

function classDisplayName(dataset: Dataset, classId: number): string {
  return (dataset.classesById.get(classId)?.name ?? dataClassName(dataset, classId)).replace(/\s*\((M|F)\)$/, '')
}

function unitDisplayName(run: RunPlan, unit: UnitDef | undefined, fallbackId: string): string {
  if (!unit) return fallbackId.replace(/^PID_/, '')
  if (unit.isCorrin) return `Corrin (${run.corrin.gender === 'male' ? 'M' : 'F'})`
  return unit.name
}

function unitSprite(unit: UnitDef | undefined, label: string, fallbackId: string) {
  return { label, ...(assetUrl('unit', unit?.id ?? fallbackId) ? { src: assetUrl('unit', unit?.id ?? fallbackId) } : {}) }
}

function classSprite(dataset: Dataset, classId: number) {
  const label = classDisplayName(dataset, classId)
  const src = assetUrl('class', classId)
  return { label, ...(src ? { src } : {}) }
}

function personalSkillId(unit: UnitDef, route: Route): number {
  return unit.personalSkills[route] ?? unit.personalSkills.revelation ?? unit.personalSkills.birthright ?? unit.personalSkills.conquest ?? 0
}

function classSource(
  entry: ClassPoolEntry,
  classId: number,
  dataset: Dataset,
  unit: UnitDef,
): ClassSourceId {
  const classDef = dataset.classesById.get(classId)
  if (classDef?.dlc) return 'dlc'
  if (entry.sourceLabel === 'Talent') return 'talent'
  if (entry.branch === 'own') {
    const primary = primaryBaseClass(dataset, unit)
    return primary !== null && baseOfClass(dataset, classId) !== baseOfClass(dataset, primary)
      ? 'secondary'
      : 'own'
  }
  if (entry.branch === 'parent') return 'parent'
  if (entry.branch === 'seal') return 'partner'
  return 'friendship'
}

function classGroupLabel(entry: ClassPoolEntry, source: ClassSourceId): string {
  if (source === 'own') return 'Own classes'
  if (source === 'secondary') return 'Secondary classes'
  if (source === 'talent') return 'Talent'
  if (source === 'dlc') return 'DLC'
  if (source === 'parent') return entry.sourceLabel.replace(/^Parent:/, 'Parent ·').trim()
  if (source === 'partner') return entry.sourceLabel.replace(/^S Seal:/, 'Partner Seal ·').trim()
  return entry.sourceLabel.replace(/^A\+ Seal:/, 'Friendship Seal ·').trim()
}

function sourceOrder(source: ClassSourceId): number {
  const order: ClassSourceId[] = ['own', 'secondary', 'talent', 'parent', 'partner', 'friendship', 'dlc']
  return order.indexOf(source)
}

function defaultClassId(dataset: Dataset, unit: UnitDef, plan: UnitPlan): number | undefined {
  if (plan.classId !== undefined) return plan.classId
  if (plan.classRoute.length > 0) return plan.classRoute[plan.classRoute.length - 1].classId
  return primaryBaseClass(dataset, unit) ?? unit.classes[0] ?? unit.reclasses[0]
}

function effectiveClassId(dataset: Dataset, run: RunPlan, unitId: string): number | undefined {
  const unit = dataset.unitsById.get(unitId)
  if (!unit) return undefined
  const plan = unitPlanFor(run, unitId)
  return defaultClassId(dataset, unit, plan)
}

function availableInRun(unit: UnitDef, run: RunPlan): boolean {
  return unit.routes.includes(run.route) && (!unit.dlc || run.dlc)
}

function rosterUnits(dataset: Dataset, run: RunPlan): UnitDef[] {
  const corrin = dataset.units.find((unit) => unit.isCorrin && unit.gender === run.corrin.gender)
  return dataset.units.filter((unit) => {
    if (!availableInRun(unit, run)) return false
    if (unit.isCorrin && unit.id !== corrin?.id) return false
    const fixedParent = unit.fixedParent ? dataset.unitsById.get(unit.fixedParent) : undefined
    if (fixedParent?.isCorrin && fixedParent.id !== corrin?.id) return false
    return unit.isCorrin || (run.units[unit.id]?.inArmy ?? true)
  })
}

function resolvedVariableParentId(dataset: Dataset, unit: UnitDef, run: RunPlan): string | undefined {
  const savedId = run.units[unit.id]?.variableParent
  const saved = savedId ? dataset.unitsById.get(savedId) : undefined
  if (saved && availableInRun(saved, run)) return saved.id
  if (!unit.fixedParent) return undefined
  const fixedParent = dataset.unitsById.get(unit.fixedParent)
  const partnerId = fixedParent ? run.units[fixedParent.id]?.sPartner : undefined
  const partner = partnerId ? dataset.unitsById.get(partnerId) : undefined
  const partnerPlan = partnerId ? run.units[partnerId] : undefined
  const edge = partner
    ? (dataset.edgesByCharacter.get(unit.fixedParent) ?? []).find((candidate) => edgePartner(candidate, unit.fixedParent!) === partner.id)
    : undefined
  return fixedParent && partner && partnerPlan?.sPartner === fixedParent.id && availableInRun(partner, run) && edge?.info.ranks.s !== null
    ? partner.id
    : undefined
}

function projectionOptions(dataset: Dataset, run: RunPlan, unit: UnitDef) {
  return {
    corrinBoon: run.corrin.boon,
    corrinBane: run.corrin.bane,
    variableParentId: resolvedVariableParentId(dataset, unit, run),
  }
}

function lastFilledSkill(plan: UnitPlan): number | undefined {
  for (let index = plan.skills.length - 1; index >= 0; index -= 1) {
    const skillId = plan.skills[index]
    if (skillId !== null && skillId !== undefined) return skillId
  }
  return undefined
}

function inheritedSkills(dataset: Dataset, run: RunPlan, unit: UnitDef, variableParentId?: string): InheritedSkill[] {
  if (!unit.fixedParent) return []
  const parents = [unit.fixedParent, variableParentId].filter((id): id is string => Boolean(id))
  return parents.flatMap((parentId) => {
    const skillId = lastFilledSkill(unitPlanFor(run, parentId))
    return skillId !== undefined && dataset.skillsById.has(skillId) ? [{ id: skillId, parentId }] : []
  })
}

function acquisitionFromRoute(
  dataset: Dataset,
  pool: ClassPoolEntry[],
  route: UnitPlan['classRoute'],
  skillId: number,
): { classId: number; level: number; label: string } | undefined {
  for (const entry of pool) {
    const classDef = dataset.classesById.get(entry.classId)
    if (!classDef) continue
    const learned = classDef.skillLearn.find((skill) => skill.id === skillId)
    if (!learned) continue
    const stop = route.find((candidate) => candidate.classId === classDef.id && candidate.toLevel >= learned.level)
    if (!stop) continue
    const sourceLabel = entry.branch === 'seal'
      ? `${entry.sourceLabel} — `
      : entry.branch === 'aplus' || entry.branch === 'parent'
        ? `${entry.sourceLabel} — `
        : ''
    return {
      classId: classDef.id,
      level: learned.level,
      label: `${sourceLabel}${classDisplayName(dataset, classDef.id)} Lv ${learned.level}`,
    }
  }
  return undefined
}

function skillGroup(source: string): { id: string; label: string } {
  if (source === 'Personal') return { id: 'personal', label: 'Personal skill' }
  if (source.startsWith('Inherited')) return { id: 'inherited', label: 'Inherited skills' }
  if (source.startsWith('Parent:')) return { id: 'parent', label: 'Parent classes' }
  if (source.startsWith('S Seal:')) return { id: 'partner', label: 'Partner Seal' }
  if (source.startsWith('A+ Seal:')) return { id: 'friendship', label: 'Friendship Seal' }
  return { id: 'class', label: 'Class skills' }
}

function resolvedSkills(
  dataset: Dataset,
  run: RunPlan,
  unit: UnitDef,
  plan: UnitPlan,
  pool: ClassPoolEntry[],
  variableParentId?: string,
): ResolvedSkill[] {
  const inherited = inheritedSkills(dataset, run, unit, variableParentId)
  const inheritedBySkill = new Map<number, string[]>()
  for (const item of inherited) {
    const names = inheritedBySkill.get(item.id) ?? []
    const parentName = unitDisplayName(run, dataset.unitsById.get(item.parentId), item.parentId)
    if (!names.includes(parentName)) names.push(parentName)
    inheritedBySkill.set(item.id, names)
  }

  const entries = skillPool(dataset, unit, pool, run.route)
  const result: ResolvedSkill[] = []
  const seen = new Set<number>()
  for (const entry of entries) {
    const skill = dataset.skillsById.get(entry.skillId)
    const classDef = entry.classId === undefined ? undefined : dataset.classesById.get(entry.classId)
    const dlc = Boolean(skill?.dlc || classDef?.dlc)
    if (!run.dlc && dlc) continue

    const routeAcquisition = acquisitionFromRoute(dataset, pool, plan.classRoute, entry.skillId)
    const parents = inheritedBySkill.get(entry.skillId) ?? []
    const source = entry.source === 'personal'
      ? 'Personal'
      : routeAcquisition?.label ?? (parents.length > 0 ? `Inherited · ${parents.join(' / ')}` : entry.label)
    const group = skillGroup(source)
    result.push({
      id: entry.skillId,
      name: skill?.name ?? skillName(dataset, entry.skillId),
      short: shortSkill(skill?.name ?? skillName(dataset, entry.skillId)),
      source,
      classId: routeAcquisition?.classId ?? entry.classId ?? -1,
      dlc,
      reached: entry.source === 'personal' || routeAcquisition !== undefined || parents.length > 0,
      equipped: false,
      onPick: () => undefined,
      groupId: group.id,
      groupLabel: group.label,
    })
    seen.add(entry.skillId)
  }

  for (const [skillId, parents] of inheritedBySkill) {
    if (seen.has(skillId)) continue
    const skill = dataset.skillsById.get(skillId)
    if (!skill || (!run.dlc && skill.dlc)) continue
    const source = `Inherited · ${parents.join(' / ')}`
    const group = skillGroup(source)
    result.push({
      id: skill.id,
      name: skill.name,
      short: shortSkill(skill.name),
      source,
      classId: -1,
      dlc: skill.dlc,
      reached: true,
      equipped: false,
      onPick: () => undefined,
      groupId: group.id,
      groupLabel: group.label,
    })
  }

  return result
}

function supportRank(dataset: Dataset, run: RunPlan, unitId: string, partnerId: string): PairUpRank | null {
  const unitPlan = unitPlanFor(run, unitId)
  const partnerPlan = unitPlanFor(run, partnerId)
  if (unitPlan.sPartner === partnerId || partnerPlan.sPartner === unitId) return 'S'
  if (unitPlan.aPlusPartner === partnerId || partnerPlan.aPlusPartner === unitId) return 'A'
  const edge = (dataset.edgesByCharacter.get(unitId) ?? []).find((candidate) => edgePartner(candidate, unitId) === partnerId)
  return edge?.info.ranks.c === null || !edge ? null : 'C'
}

function supportPartnerFor(plan: UnitPlan, rank: 'S' | 'A+'): string | undefined {
  return rank === 'S' ? plan.sPartner : plan.aPlusPartner
}

function clearSupportPartner(runId: string, unitId: string, rank: 'S' | 'A+'): void {
  const store = usePlansStore.getState()
  store.updateUnit(runId, unitId, (plan) => rank === 'S'
    ? { ...plan, sPartner: undefined }
    : { ...plan, aPlusPartner: undefined })
}

function clearSupportParticipant(runId: string, unitId: string, rank: 'S' | 'A+'): void {
  const state = usePlansStore.getState()
  const run = state.runs.find((candidate) => candidate.id === runId)
  const previous = run ? supportPartnerFor(unitPlanFor(run, unitId), rank) : undefined
  clearSupportPartner(runId, unitId, rank)
  if (!run || !previous || previous === unitId) return
  const updatedRun = usePlansStore.getState().runs.find((candidate) => candidate.id === runId)
  if (updatedRun && supportPartnerFor(unitPlanFor(updatedRun, previous), rank) === unitId) {
    clearSupportPartner(runId, previous, rank)
  }
}

function setSymmetricSupportPartner(
  runId: string,
  dataset: Dataset,
  unitId: string,
  rank: 'S' | 'A+',
  partnerId: string | null,
): void {
  const state = usePlansStore.getState()
  const run = state.runs.find((candidate) => candidate.id === runId)
  if (!run) return
  const previousUnitPartner = supportPartnerFor(unitPlanFor(run, unitId), rank)
  const previousPartnerUnit = partnerId ? supportPartnerFor(unitPlanFor(run, partnerId), rank) : undefined
  const formerPairs = new Map<string, [string, string]>()
  if (rank === 'S') {
    if (previousUnitPartner && previousUnitPartner !== unitId && previousUnitPartner !== partnerId) {
      formerPairs.set([unitId, previousUnitPartner].sort().join('|'), [unitId, previousUnitPartner])
    }
    if (partnerId && previousPartnerUnit && previousPartnerUnit !== partnerId && previousPartnerUnit !== unitId) {
      formerPairs.set([partnerId, previousPartnerUnit].sort().join('|'), [partnerId, previousPartnerUnit])
    }
  }

  clearSupportParticipant(runId, unitId, rank)
  if (partnerId && partnerId !== unitId) clearSupportParticipant(runId, partnerId, rank)
  if (partnerId && partnerId !== unitId) {
    const store = usePlansStore.getState()
    store.updateUnit(runId, unitId, (plan) => rank === 'S'
      ? { ...plan, sPartner: partnerId }
      : { ...plan, aPlusPartner: partnerId })
    store.updateUnit(runId, partnerId, (plan) => rank === 'S'
      ? { ...plan, sPartner: unitId }
      : { ...plan, aPlusPartner: unitId })
  }

  if (rank === 'S') {
    const store = usePlansStore.getState()
    for (const [a, b] of formerPairs.values()) {
      for (const child of childrenOfPair(dataset, a, b)) {
        const expectedParent = child.fixedParent === a ? b : a
        store.updateUnit(runId, child.id, (plan) => plan.variableParent === expectedParent
          ? { ...plan, variableParent: undefined }
          : plan)
      }
    }
    if (partnerId && partnerId !== unitId) {
      for (const child of childrenOfPair(dataset, unitId, partnerId)) {
        const variableParent = child.fixedParent === unitId ? partnerId : unitId
        store.updateUnit(runId, child.id, (plan) => ({ ...plan, variableParent }))
      }
    }
  }
}

function clearCombatPartner(runId: string, unitId: string): void {
  const store = usePlansStore.getState()
  const run = store.runs.find((candidate) => candidate.id === runId)
  if (!run) return
  const partnerId = unitPlanFor(run, unitId).combatPartner
  if (partnerId && unitPlanFor(run, partnerId).combatPartner === unitId) {
    store.updateUnit(runId, partnerId, (plan) => {
      const next = { ...plan }
      delete next.combatPartner
      delete next.combatRole
      return next
    })
  }
  store.updateUnit(runId, unitId, (plan) => {
    const next = { ...plan }
    delete next.combatPartner
    delete next.combatRole
    return next
  })
}

function linkCombatPartner(runId: string, unitId: string, partnerId: string): void {
  const store = usePlansStore.getState()
  const run = store.runs.find((candidate) => candidate.id === runId)
  if (!run) return
  const unitPlan = unitPlanFor(run, unitId)
  const partnerPlan = unitPlanFor(run, partnerId)
  const role = unitPlan.combatRole ?? 'front'
  const previousUnitPartner = unitPlan.combatPartner
  const previousChosenPartner = partnerPlan.combatPartner

  if (previousUnitPartner && previousUnitPartner !== partnerId && unitPlanFor(run, previousUnitPartner).combatPartner === unitId) {
    store.updateUnit(runId, previousUnitPartner, (plan) => {
      const next = { ...plan }
      delete next.combatPartner
      delete next.combatRole
      return next
    })
  }
  if (previousChosenPartner && previousChosenPartner !== unitId && unitPlanFor(run, previousChosenPartner).combatPartner === partnerId) {
    store.updateUnit(runId, previousChosenPartner, (plan) => {
      const next = { ...plan }
      delete next.combatPartner
      delete next.combatRole
      return next
    })
  }

  store.updateUnit(runId, unitId, (plan) => ({ ...plan, combatPartner: partnerId, combatRole: role }))
  store.updateUnit(runId, partnerId, (plan) => ({
    ...plan,
    combatPartner: unitId,
    combatRole: role === 'front' ? 'back' : 'front',
  }))
}

function setCombatRole(runId: string, unitId: string, role: 'front' | 'back'): void {
  const store = usePlansStore.getState()
  const run = store.runs.find((candidate) => candidate.id === runId)
  if (!run) return
  const partnerId = unitPlanFor(run, unitId).combatPartner
  store.updateUnit(runId, unitId, (plan) => ({ ...plan, combatRole: role }))
  if (partnerId && unitPlanFor(run, partnerId).combatPartner === unitId) {
    store.updateUnit(runId, partnerId, (plan) => ({ ...plan, combatRole: role === 'front' ? 'back' : 'front' }))
  }
}

function pairUpRankLabel(rank: PairUpRank | null): string {
  return rank ? `${rank} support` : 'no support rank'
}

function makePartnerSheet(
  dataset: Dataset,
  run: RunPlan,
  unit: UnitDef,
  ui: ReturnType<typeof usePlannerUiStore.getState>,
): PartnerSheetVM | null {
  const sheet = ui.partnerSheet
  if (!sheet || sheet.unitId !== unit.id) return null
  const plan = unitPlanFor(run, unit.id)
  const anchorId = sheet.rank === 'Parent' ? unit.fixedParent : unit.id
  if (!anchorId) return null
  const anchor = dataset.unitsById.get(anchorId)
  if (!anchor) return null

  const current = sheet.rank === 'S'
    ? plan.sPartner
    : sheet.rank === 'A+'
      ? plan.aPlusPartner
      : resolvedVariableParentId(dataset, unit, run)
  const edges = supportPartners(dataset, anchorId, sheet.rank === 'A+' ? 'a-rank' : 'romantic')
  const rosterIds = new Set(rosterUnits(dataset, run).map((candidate) => candidate.id))
  const options: PartnerOptionVM[] = edges
    .map((edge) => {
      const partnerId = edgePartner(edge, anchorId)
      const partner = dataset.unitsById.get(partnerId)
      if (!partner || (sheet.rank === 'A+' && partner.gender !== anchor.gender)) return null
      if (partnerId === unit.id || partnerId === anchorId) return null
      if (!rosterIds.has(partnerId)) return null
      if (sheet.rank !== 'A+' && edge.info.ranks.s === null) return null
      return {
        id: partnerId,
        name: unitDisplayName(run, partner, partnerId),
        sprite: unitSprite(partner, unitDisplayName(run, partner, partnerId), partnerId),
        romantic: edge.info.kind === 'romantic',
        fast: edge.info.fast,
        hasS: edge.info.ranks.s !== null,
        hasA: edge.info.ranks.a !== null,
        current: partnerId === current ? (sheet.rank === 'A+' ? 'A+' : 'S') : null,
        onPick: () => {
          if (sheet.rank === 'Parent') {
            usePlansStore.getState().updateUnit(run.id, unit.id, (currentPlan) => ({ ...currentPlan, variableParent: partnerId }))
          } else {
            setSymmetricSupportPartner(run.id, dataset, unit.id, sheet.rank, partnerId)
          }
          ui.closePartnerSheet()
        },
      }
    })
    .filter((option): option is PartnerOptionVM => option !== null)
    .sort((a, b) => {
      if (Boolean(a.current) !== Boolean(b.current)) return a.current ? -1 : 1
      const score = (option: PartnerOptionVM) =>
        (option.romantic ? 2 : 0) + (option.hasA ? 1 : 0) + (option.fast ? 0.5 : 0)
      return score(b) - score(a) || a.name.localeCompare(b.name)
    })

  return {
    unitId: unit.id,
    unitName: unitDisplayName(run, unit, unit.id),
    rank: sheet.rank,
    options,
    onClose: () => ui.closePartnerSheet(),
    onClear: () => {
      if (sheet.rank === 'Parent') {
        usePlansStore.getState().updateUnit(run.id, unit.id, (currentPlan) => ({ ...currentPlan, variableParent: undefined }))
      } else {
        setSymmetricSupportPartner(run.id, dataset, unit.id, sheet.rank, null)
      }
      ui.closePartnerSheet()
    },
  }
}

function makeClassGroups(
  dataset: Dataset,
  run: RunPlan,
  ui: ReturnType<typeof usePlannerUiStore.getState>,
  unit: UnitDef,
  entries: ClassPoolEntry[],
  selectedClassId: number | undefined,
): { groups: ClassGroupVM[]; availableClassIds: Set<number>; hiddenDlcCount: number } {
  const grouped = new Map<string, { source: ClassSourceId; label: string; entries: ClassPoolEntry[] }>()
  const availableClassIds = new Set<number>()
  let hiddenDlcCount = 0

  for (const entry of entries) {
    const classDef = dataset.classesById.get(entry.classId)
    if (!classDef) continue
    const source = classSource(entry, entry.classId, dataset, unit)
    if (classDef.dlc && !run.dlc) {
      hiddenDlcCount += 1
      continue
    }
    const label = classGroupLabel(entry, source)
    const key = `${source}:${label}`
    const group = grouped.get(key) ?? { source, label, entries: [] }
    if (!group.entries.some((candidate) => candidate.classId === entry.classId)) group.entries.push(entry)
    grouped.set(key, group)
    availableClassIds.add(entry.classId)
  }

  const groups: ClassGroupVM[] = [...grouped.entries()]
    .sort(([, a], [, b]) => sourceOrder(a.source) - sourceOrder(b.source) || a.label.localeCompare(b.label))
    .map(([id, group]) => ({
      id,
      label: group.label,
      source: group.source,
      options: group.entries.map((entry) => {
        const classDef = dataset.classesById.get(entry.classId)!
        const projection = projectUnit(dataset, unit, entry.classId, projectionOptions(dataset, run, unit))
        const compareIndex = ui.compareClassIds.indexOf(entry.classId)
        return {
          key: `${id}-${entry.classId}`,
          classId: entry.classId,
          name: classDisplayName(dataset, entry.classId),
          sprite: classSprite(dataset, entry.classId),
          tier: classDef.tier,
          tierLabel: classDef.tier === 'base' ? 'Base' : classDef.tier === 'promoted' ? 'Promoted' : 'Special',
          source: group.source,
          dlc: classDef.dlc,
          growths: projection.growths,
          growthTotal: projection.growths.reduce((sum, value) => sum + value, 0),
          caps: projection.caps,
          skills: classDef.skills
            .filter((skillId) => run.dlc || !dataset.skillsById.get(skillId)?.dlc)
            .map((skillId) => ({ id: skillId, name: skillName(dataset, skillId), short: shortSkill(skillName(dataset, skillId)) })),
          selected: entry.classId === selectedClassId,
          compareState: compareIndex === 0 ? 'a' : compareIndex === 1 ? 'b' : 'none',
          hiddenByDlc: false,
          onSelect: () => {
            usePlansStore.getState().updateUnit(run.id, unit.id, (currentPlan) => ({ ...currentPlan, classId: entry.classId }))
          },
          onCompare: () => ui.toggleCompareClass(entry.classId),
        }
      }),
    }))

  return { groups, availableClassIds, hiddenDlcCount }
}

function makeCompare(
  dataset: Dataset,
  run: RunPlan,
  ui: ReturnType<typeof usePlannerUiStore.getState>,
  unit: UnitDef,
  poolClassIds: Set<number>,
): ClassCompareVM | null {
  const selected = ui.compareClassIds.filter((id) => poolClassIds.has(id) && dataset.classesById.has(id))
  if (selected.length !== 2) return null
  const projections = selected.map((classId) => projectUnit(dataset, unit, classId, projectionOptions(dataset, run, unit)))
  const classDefs = selected.map((classId) => dataset.classesById.get(classId)!)
  const rows: ClassCompareVM['rows'] = [
    ...STAT_KEYS.map((key, index) => {
      const values = projections.map((projection) => projection.growths[index])
      return {
        label: `${STAT_LABELS[key]} growth`,
        values: values.map((value) => `${value}%`),
        bestIndex: values[0] === values[1] ? -1 : values[0] > values[1] ? 0 : 1,
      }
    }),
    ...STAT_KEYS.map((key, index) => {
      const values = projections.map((projection) => projection.caps[index])
      return {
        label: `${STAT_LABELS[key]} cap`,
        values: values.map(String),
        bestIndex: values[0] === values[1] ? -1 : values[0] > values[1] ? 0 : 1,
      }
    }),
    {
      label: 'Class skills',
      values: classDefs.map((classDef) => classDef.skills.map((skillId) => shortSkill(skillName(dataset, skillId))).join(' ')),
      bestIndex: -1,
    },
  ]

  return {
    columns: selected.map((classId) => ({ classId, name: classDisplayName(dataset, classId), sprite: classSprite(dataset, classId) })),
    rows,
    onClear: () => ui.clearCompareClasses(),
  }
}

function formatGrantedBonus(bonuses: number[]): string {
  return STAT_KEYS.flatMap((key, index) => bonuses[index] ? [`${STAT_LABELS[key]} ${bonuses[index] > 0 ? '+' : ''}${bonuses[index]}`] : []).join(' · ') || 'no stat bonus'
}

function emptyVM(unitId: string, ui: ReturnType<typeof usePlannerUiStore.getState>): UnitVM {
  return {
    id: unitId,
    name: unitId.replace(/^PID_/, ''),
    sprite: { label: unitId },
    className: '—',
    levelLabel: '—',
    isChild: false,
    relationships: [],
    classGroups: [],
    compare: null,
    stats: {
      level: ui.statLevel,
      levels: [10, 15, 20],
      onSetLevel: (level) => ui.setStatLevel(level),
      rows: [],
      partnerNote: null,
    },
    skills: {
      slots: Array.from({ length: 5 }, (_, slot) => ({ slot, skill: null, onOpen: () => ui.openSkillSheet(unitId, slot), onClear: () => undefined })),
      personal: { id: 0, name: '—', short: '—' },
      onOpenPicker: (slot) => ui.openSkillSheet(unitId, slot),
    },
    skillPicker: null,
    inheritance: null,
    combat: {
      partnerName: null,
      role: 'front',
      onSetRole: () => undefined,
      onOpenPartnerPicker: () => ui.setCombatSheet(unitId),
    },
    combatSheet: null,
    partnerSheet: null,
    warnings: [],
    onOpenRoute: () => navigate({ name: 'unit-route', unitId }),
    onBack: () => navigate({ name: 'pairings' }),
  }
}

export function useUnitVM(unitId: string): UnitVM {
  const plans = usePlansStore()
  const ui = usePlannerUiStore()
  const run = plans.runs.find((item) => item.id === plans.activeRunId) ?? plans.runs[0]
  const resource = useDataset(getBuildProfile(run?.modpackId ?? 'ugf-2.5.2').packId)

  if (!run || !resource.data) return emptyVM(unitId, ui)
  const dataset = resource.data
  const unit = dataset.unitsById.get(unitId)
  if (!unit) return emptyVM(unitId, ui)

  const plan = unitPlanFor(run, unit.id)
  const selectedClassId = defaultClassId(dataset, unit, plan)
  const selectedClass = selectedClassId === undefined ? undefined : dataset.classesById.get(selectedClassId)
  const fixedParent = unit.fixedParent ? dataset.unitsById.get(unit.fixedParent) : undefined
  const variableParentId = resolvedVariableParentId(dataset, unit, run)
  const variableParent = variableParentId ? dataset.unitsById.get(variableParentId) : undefined
  const sPartner = plan.sPartner ? dataset.unitsById.get(plan.sPartner) : undefined
  const aPlusPartner = plan.aPlusPartner ? dataset.unitsById.get(plan.aPlusPartner) : undefined
  const pool = classPool(dataset, unit, {
    variableParent,
    sPartner,
    aPlusPartner,
    corrinTalentClassId: run.corrin.talentClassId,
    fixedParentIsCorrin: fixedParentIsCorrin(dataset, unit),
  })
  const { groups: classGroups, availableClassIds, hiddenDlcCount } = makeClassGroups(
    dataset,
    run,
    ui,
    unit,
    pool,
    selectedClassId,
  )
  const compare = makeCompare(dataset, run, ui, unit, availableClassIds)
  const level = ui.statLevel
  const projection = projectUnit(dataset, unit, selectedClassId, projectionOptions(dataset, run, unit))
  const personalProjection = projectUnit(dataset, unit, undefined, projectionOptions(dataset, run, unit))
  const classGrowths = selectedClass?.growths ?? Array.from({ length: STAT_KEYS.length }, () => 0)
  const partnerId = plan.combatPartner
  const partner = partnerId ? dataset.unitsById.get(partnerId) : undefined
  const partnerClassId = partnerId ? effectiveClassId(dataset, run, partnerId) : undefined
  const partnerClass = partnerClassId === undefined ? undefined : dataset.classesById.get(partnerClassId)
  const rank = partnerId ? supportRank(dataset, run, unit.id, partnerId) : null
  const delta = partner && partnerClass && plan.combatRole !== 'back'
    ? pairUpBonus(partnerClass.pairUp, partner.supportBonuses, rank)
    : undefined
  const role = plan.combatRole ?? 'front'
  const statRows = STAT_KEYS.map((key, index) => {
    const base = projection.stats[index] ?? 0
    const totalGrowth = projection.growths[index] ?? 0
    const cap = projection.caps[index] ?? 0
    const average = Math.max(1, base + Math.floor((totalGrowth * Math.max(0, level - 1)) / 100))
    const value = cap > 0 ? Math.min(cap, average) : average
    return {
      key,
      label: STAT_LABELS[key],
      value,
      personalGrowth: personalProjection.growths[index] ?? 0,
      classGrowth: classGrowths[index] ?? 0,
      cap,
      capMod: index === 0 ? 0 : cap - (selectedClass?.caps[index] ?? 0),
      ...(delta && delta[index] ? { delta: delta[index] } : {}),
    }
  })
  const stats: UnitVM['stats'] = {
    level,
    levels: [10, 15, 20],
    onSetLevel: (next) => ui.setStatLevel(next),
    rows: statRows,
    partnerNote: partnerId && partner
      ? role === 'front'
        ? `Pair-up from ${unitDisplayName(run, partner, partnerId)} · ${pairUpRankLabel(rank)}`
        : `Back with ${unitDisplayName(run, partner, partnerId)} · grants ${formatGrantedBonus(pairUpBonus(selectedClass?.pairUp, unit.supportBonuses, rank))}`
      : null,
  }

  const skills = resolvedSkills(dataset, run, unit, plan, pool, variableParentId)
  const inherited = inheritedSkills(dataset, run, unit, variableParentId)
  const equipped = Array.from({ length: 5 }, (_, index) => plan.skills[index] ?? null)
  const persistSkills = (next: (number | null)[]) => {
    usePlansStore.getState().updateUnit(run.id, unit.id, (currentPlan) => ({ ...currentPlan, skills: next }))
  }
  const skillOptions: SkillOptionVM[] = skills.map((entry) => ({
    id: entry.id,
    name: entry.name,
    short: entry.short,
    source: entry.source,
    classId: entry.classId,
    dlc: entry.dlc,
    reached: entry.reached,
    equipped: equipped.includes(entry.id),
    onPick: () => {
      const next = [...equipped]
      for (let index = 0; index < next.length; index += 1) {
        if (next[index] === entry.id && index !== (ui.skillSheet?.slot ?? -1)) next[index] = null
      }
      if (ui.skillSheet) next[ui.skillSheet.slot] = entry.id
      persistSkills(next)
      ui.closeSkillSheet()
    },
    ...(entry.classId > 0 && !entry.reached
      ? { onAddStop: () => { ui.setAddStopOpen(true); navigate({ name: 'unit-route', unitId: unit.id }) } }
      : {}),
  }))
  const skillGroups: SkillPickerVM['groups'] = []
  for (const option of skillOptions) {
    const entry = skills.find((candidate) => candidate.id === option.id)
    if (!entry) continue
    let group = skillGroups.find((candidate) => candidate.id === entry.groupId)
    if (!group) {
      group = { id: entry.groupId, label: entry.groupLabel, options: [] }
      skillGroups.push(group)
    }
    group.options.push(option)
  }
  const skillSheet = ui.skillSheet?.unitId === unit.id ? ui.skillSheet : null
  const skillPicker: SkillPickerVM | null = skillSheet
    ? {
        slot: skillSheet.slot,
        options: skillOptions,
        groups: skillGroups,
        onClearSlot: () => {
          const next = [...equipped]
          next[skillSheet.slot] = null
          persistSkills(next)
          ui.closeSkillSheet()
        },
        onClose: () => ui.closeSkillSheet(),
      }
    : null

  const personalId = personalSkillId(unit, run.route)
  const personalDef = dataset.skillsById.get(personalId)
  const personalSkill = {
    id: personalId,
    name: personalDef?.name ?? skillName(dataset, personalId),
    short: shortSkill(personalDef?.name ?? skillName(dataset, personalId)),
  }
  const optionBySkill = new Map(skillOptions.map((option) => [option.id, option]))
  const inheritedParentNames = new Map<number, string[]>()
  for (const item of inherited) {
    const names = inheritedParentNames.get(item.id) ?? []
    const name = unitDisplayName(run, dataset.unitsById.get(item.parentId), item.parentId)
    if (!names.includes(name)) names.push(name)
    inheritedParentNames.set(item.id, names)
  }
  const slots: UnitVM['skills']['slots'] = equipped.map((skillId, slot) => {
    const skill = skillId === null ? undefined : dataset.skillsById.get(skillId)
    const option = skillId === null ? undefined : optionBySkill.get(skillId)
    const parentNames = skillId === null ? [] : inheritedParentNames.get(skillId) ?? []
    return {
      slot,
      skill: skillId === null
        ? null
        : {
            id: skillId,
            name: skill?.name ?? skillName(dataset, skillId),
            short: shortSkill(skill?.name ?? skillName(dataset, skillId)),
            source: option?.source ?? (parentNames.length ? `Inherited · ${parentNames.join(' / ')}` : skill?.dlc ? 'DLC skill' : 'Outside current pool'),
          },
      onOpen: () => ui.openSkillSheet(unit.id, slot),
      onClear: () => {
        const next = [...equipped]
        next[slot] = null
        persistSkills(next)
      },
    }
  })

  const fixedParentId = unit.fixedParent ?? undefined
  const variableParentName = variableParentId
    ? unitDisplayName(run, dataset.unitsById.get(variableParentId), variableParentId)
    : 'unset'
  const relationships: UnitVM['relationships'] = []
  if (fixedParentId) {
    const fixedName = unitDisplayName(run, dataset.unitsById.get(fixedParentId), fixedParentId)
    const fixedGender = dataset.unitsById.get(fixedParentId)?.gender
    relationships.push({ id: 'fixed-parent', label: fixedGender === 'female' ? 'Mum' : 'Dad', value: fixedName, tone: 'fixed' })
    relationships.push({
      id: 'variable-parent',
      label: 'Parent',
      value: variableParentName,
      tone: variableParentId ? 'accent' : 'plain',
      onOpen: () => ui.openPartnerSheet(unit.id, 'Parent'),
    })
  }
  relationships.push({
    id: 's-partner',
    label: 'S',
    value: plan.sPartner ? unitDisplayName(run, dataset.unitsById.get(plan.sPartner), plan.sPartner) : 'unset',
    rank: 'S',
    tone: plan.sPartner ? 'accent' : 'plain',
    onOpen: () => ui.openPartnerSheet(unit.id, 'S'),
  })
  relationships.push({
    id: 'a-plus',
    label: 'A+',
    value: plan.aPlusPartner ? unitDisplayName(run, dataset.unitsById.get(plan.aPlusPartner), plan.aPlusPartner) : 'unset',
    rank: 'A+',
    tone: plan.aPlusPartner ? 'accent' : 'plain',
    onOpen: () => ui.openPartnerSheet(unit.id, 'A+'),
  })
  relationships.push({
    id: 'combat',
    label: role === 'front' ? 'Front' : 'Back',
    value: partnerId ? `w/ ${unitDisplayName(run, partner, partnerId)}` : 'pick partner',
    tone: partnerId ? 'accent' : 'plain',
    onOpen: () => ui.setCombatSheet(unit.id),
  })

  let inheritance: InheritanceVM | null = null
  if (fixedParent) {
    const variableParentRow = variableParentId ? dataset.unitsById.get(variableParentId) : undefined
    const fixedSkill = lastFilledSkill(unitPlanFor(run, fixedParent.id))
    const variableSkill = variableParentId ? lastFilledSkill(unitPlanFor(run, variableParentId)) : undefined
    const toSkill = (skillId: number | undefined) => skillId === undefined
      ? null
      : { id: skillId, name: skillName(dataset, skillId), short: shortSkill(skillName(dataset, skillId)) }
    const branchLabel = (parent: UnitDef | undefined, roleLabel: string) => {
      if (!parent) return undefined
      const baseId = primaryBaseClass(dataset, parent)
      return baseId === null ? undefined : `${roleLabel} · ${classDisplayName(dataset, baseId)}`
    }
    inheritance = {
      rule: 'Shows each parent’s last filled planned skill slot. The game’s exact last-skill inheritance timing is not verified.',
      fixedParent: {
        name: unitDisplayName(run, fixedParent, fixedParent.id),
        sprite: unitSprite(fixedParent, unitDisplayName(run, fixedParent, fixedParent.id), fixedParent.id),
        skill: toSkill(fixedSkill),
      },
      variableParent: {
        name: variableParentRow ? unitDisplayName(run, variableParentRow, variableParentId!) : 'unset',
        sprite: unitSprite(variableParentRow, variableParentName, variableParentId ?? unit.id),
        skill: toSkill(variableSkill),
      },
      branches: [branchLabel(fixedParent, 'Fixed'), branchLabel(variableParentRow, 'Variable')].filter((value): value is string => Boolean(value)),
    }
  }

  const warnings: WarningVM[] = []
  const turnOnDlc = () => plans.updateRun(run.id, { dlc: true })
  if (!run.dlc && hiddenDlcCount > 0) {
    warnings.push({
      id: 'dlc-off-pool',
      message: `${hiddenDlcCount} DLC classes are hidden while DLC is off.`,
      actionLabel: 'Turn DLC on',
      onAction: turnOnDlc,
    })
  }
  if (!run.dlc && unit.dlc) {
    warnings.push({ id: 'dlc-unit', message: `${unit.name} is DLC-only while DLC is off.`, actionLabel: 'Turn DLC on', onAction: turnOnDlc })
  }
  if (!run.dlc && selectedClass?.dlc) {
    warnings.push({
      id: 'dlc-selected-class',
      message: `${classDisplayName(dataset, selectedClass.id)} is selected while DLC is off.`,
      actionLabel: 'Turn DLC on',
      onAction: turnOnDlc,
    })
  }
  if (!run.dlc && partner?.dlc) {
    warnings.push({
      id: 'dlc-combat-partner',
      message: `${partner.name} is the selected combat partner while DLC is off.`,
      actionLabel: 'Turn DLC on',
      onAction: turnOnDlc,
    })
  }
  if (!run.dlc && partnerClass?.dlc) {
    warnings.push({
      id: 'dlc-combat-class',
      message: `${classDisplayName(dataset, partnerClass.id)} is the combat partner’s selected class while DLC is off.`,
      actionLabel: 'Turn DLC on',
      onAction: turnOnDlc,
    })
  }
  if (!run.dlc) {
    for (const [index, stop] of plan.classRoute.entries()) {
      if (!dataset.classesById.get(stop.classId)?.dlc) continue
      warnings.push({
        id: `dlc-route-${index}`,
        message: `${classDisplayName(dataset, stop.classId)} is on the class route while DLC is off.`,
        actionLabel: 'Turn DLC on',
        onAction: turnOnDlc,
      })
    }
    for (const skillId of new Set(equipped.filter((id): id is number => id !== null))) {
      const skill = dataset.skillsById.get(skillId)
      if (!skill?.dlc) continue
      warnings.push({
        id: `dlc-skill-${skillId}`,
        message: `${skill.name} is equipped while DLC is off.`,
        actionLabel: 'Turn DLC on',
        onAction: turnOnDlc,
      })
    }
    for (const inheritedSkill of inherited) {
      const skill = dataset.skillsById.get(inheritedSkill.id)
      if (!skill?.dlc) continue
      const parentName = unitDisplayName(run, dataset.unitsById.get(inheritedSkill.parentId), inheritedSkill.parentId)
      warnings.push({
        id: `dlc-inherited-${inheritedSkill.parentId}-${skill.id}`,
        message: `${skill.name} is inherited from ${parentName} while DLC is off.`,
        actionLabel: 'Turn DLC on',
        onAction: turnOnDlc,
      })
    }
  }
  for (const skillId of new Set(equipped.filter((id): id is number => id !== null))) {
    const option = optionBySkill.get(skillId)
    if (!option || option.reached) continue
    warnings.push({
      id: `unreached-${skillId}`,
      message: `${option.name} is not reached by the planned class route (${option.source}).`,
      actionLabel: 'Open route',
      onAction: () => { ui.setAddStopOpen(true); navigate({ name: 'unit-route', unitId: unit.id }) },
    })
  }

  const combatSheet: CombatSheetVM | null = ui.combatSheet === unit.id
    ? {
        unitId: unit.id,
        options: rosterUnits(dataset, run)
          .filter((candidate) => candidate.id !== unit.id)
          .map((candidate) => ({
            id: candidate.id,
            name: unitDisplayName(run, candidate, candidate.id),
            sprite: unitSprite(candidate, unitDisplayName(run, candidate, candidate.id), candidate.id),
            current: plan.combatPartner === candidate.id,
            onPick: () => linkCombatPartner(run.id, unit.id, candidate.id),
          })),
        onClear: () => clearCombatPartner(run.id, unit.id),
        onClose: () => ui.setCombatSheet(null),
      }
    : null

  const personalClassLabel = selectedClass ? classDisplayName(dataset, selectedClass.id) : 'No class selected'
  const levelLabel = plan.classRoute.length > 0
    ? `Lv ${plan.classRoute[0].fromLevel} → ${plan.classRoute[plan.classRoute.length - 1].toLevel}`
    : 'Lv 1 → 20'
  const displayedUnitName = unitDisplayName(run, unit, unit.id)

  return {
    id: unit.id,
    name: displayedUnitName,
    sprite: unitSprite(unit, displayedUnitName, unit.id),
    className: personalClassLabel,
    levelLabel,
    isChild: Boolean(unit.fixedParent),
    relationships,
    classGroups,
    compare,
    stats,
    skills: {
      slots,
      personal: personalSkill,
      onOpenPicker: (slot) => ui.openSkillSheet(unit.id, slot),
    },
    skillPicker,
    inheritance,
    combat: {
      partnerName: partner ? unitDisplayName(run, partner, partner.id) : null,
      role,
      onSetRole: (nextRole) => setCombatRole(run.id, unit.id, nextRole),
      onOpenPartnerPicker: () => ui.setCombatSheet(unit.id),
    },
    combatSheet,
    partnerSheet: makePartnerSheet(dataset, run, unit, ui),
    warnings,
    onOpenRoute: () => navigate({ name: 'unit-route', unitId: unit.id }),
    onBack: () => navigate({ name: 'pairings' }),
  }
}
