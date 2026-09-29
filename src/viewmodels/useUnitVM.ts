import { navigate } from '../lib/router'
import type { StatKey } from '../data/types'
import {
  classRow,
  className,
  combinedGrowths,
  learnLevel,
  personalGrowths,
  poolGroups,
  projectedStats,
  routeHasClass,
  skillName,
  tierLabel,
  unitRow,
} from '../prototype/derive'
import { PROTO_CLASSES, PAIRUP_DELTAS, ROSTER_IDS, ROUTE_ILLEGAL_WARNING, STAT_KEYS_ORDER, SHIRO_STATS } from '../prototype/fixtures'
import { rosterIds } from '../prototype/selectors'
import { planFor, protoActions, useProtoState, type ProtoState } from '../prototype/state'
import type {
  ClassCompareVM,
  ClassGroupVM,
  ClassOptionVM,
  CombatSheetVM,
  InheritanceVM,
  SkillOptionVM,
  SkillPickerVM,
  StatRowVM,
  UnitVM,
  WarningVM,
} from './types'
import { classSprite, partnerSheetFor, skillShort, spriteFor } from './shared'

interface PoolSkill {
  id: number
  name: string
  short: string
  sourceLabel: string
  classId: number
  level: number
  dlc: boolean
  reached: boolean
}

function routeIndex(route: string): number {
  return route === 'birthright' ? 0 : route === 'conquest' ? 1 : 2
}

function personalSkillId(state: ProtoState, unitId: string): number {
  const row = unitRow(unitId)
  return row?.personal[routeIndex(state.route)] ?? row?.personal[2] ?? 0
}

function buildPoolSkills(state: ProtoState, unitId: string): PoolSkill[] {
  const plan = planFor(state, unitId)
  const skills: PoolSkill[] = []
  const personalId = personalSkillId(state, unitId)
  if (personalId) {
    skills.push({
      id: personalId,
      name: skillName(personalId),
      short: skillShort(personalId),
      sourceLabel: 'Personal',
      classId: -1,
      level: 0,
      dlc: false,
      reached: true,
    })
  }
  for (const group of poolGroups(unitId)) {
    for (const classId of group.classIds) {
      const cls = classRow(classId)
      if (!cls) continue
      cls.skills.forEach((skillId, index) => {
        const level = learnLevel(cls.tier, index)
        skills.push({
          id: skillId,
          name: skillName(skillId),
          short: skillShort(skillId),
          sourceLabel: `${className(classId)} · ${level}`,
          classId,
          level,
          dlc: Boolean(cls.dlc),
          reached: routeHasClass(plan.route, classId, level),
        })
      })
    }
  }
  return skills
}

function skillSourceLabel(pool: PoolSkill[], plan: ReturnType<typeof planFor>, skillId: number): string {
  const hit = pool.find((entry) => entry.id === skillId)
  if (hit) return hit.sourceLabel
  if (plan.inherit?.fixed === skillId || plan.inherit?.variable === skillId) return 'Inherited'
  return 'Unknown'
}

export function useUnitVM(unitId: string): UnitVM {
  const state = useProtoState()
  const row = unitRow(unitId) ?? unitRow(ROSTER_IDS[0])!
  const plan = planFor(state, unitId)
  const classId = plan.classId ?? row.classes[0]
  const variableParentId = plan.variableParent
  const level = state.statLevel

  const pool = buildPoolSkills(state, unitId)
  const groups = poolGroups(unitId)

  const classGroups: ClassGroupVM[] = []
  let hiddenDlc = 0
  for (const group of groups) {
    if (group.source === 'dlc' && !state.dlc) {
      hiddenDlc += group.classIds.length
      continue
    }
    const options: ClassOptionVM[] = group.classIds.map((optionClassId) => {
      const optionCls = classRow(optionClassId)
      const growths = combinedGrowths(unitId, optionClassId, variableParentId)
      const caps = projectedStats(unitId, optionClassId, level).map((stat) => stat.cap)
      const compareIndex = state.compareClassIds.indexOf(optionClassId)
      return {
        key: `${group.source}-${optionClassId}`,
        classId: optionClassId,
        name: className(optionClassId),
        sprite: classSprite(optionClassId),
        tier: optionCls?.tier ?? 'base',
        tierLabel: tierLabel(optionCls?.tier ?? 'base'),
        source: group.source,
        dlc: Boolean(optionCls?.dlc),
        growths,
        growthTotal: growths.reduce((sum, value) => sum + value, 0),
        caps,
        skills: (optionCls?.skills ?? []).map((skillId) => ({
          id: skillId,
          name: skillName(skillId),
          short: skillShort(skillId),
        })),
        selected: optionClassId === classId,
        compareState: compareIndex === 0 ? 'a' : compareIndex === 1 ? 'b' : 'none',
        hiddenByDlc: false,
        onSelect: () => protoActions.setClass(unitId, optionClassId),
        onCompare: () => protoActions.toggleCompareClass(optionClassId),
      }
    })
    classGroups.push({ id: `${group.source}-${group.label}`, label: group.label, source: group.source, note: group.note, options })
  }

  const compareColumns = state.compareClassIds.filter((id) => PROTO_CLASSES[id])
  const compare: ClassCompareVM | null =
    compareColumns.length === 2
      ? {
          columns: compareColumns.map((id) => ({ classId: id, name: className(id), sprite: classSprite(id) })),
          rows: [
            ...STAT_KEYS_ORDER.map((key, index) => {
              const values = compareColumns.map((id) => combinedGrowths(unitId, id, variableParentId)[index])
              return {
                label: key.toUpperCase(),
                values: values.map((value) => `${value}%`),
                bestIndex: values[0] === values[1] ? -1 : values[0] > values[1] ? 0 : 1,
              }
            }),
            {
              label: 'Class skills',
              values: compareColumns.map((id) => (classRow(id)?.skills ?? []).map((skillId) => skillShort(skillId)).join(' ')),
              bestIndex: -1,
            },
          ],
          onClear: () => protoActions.clearCompareClasses(),
        }
      : null

  const stats = buildStats(state, unitId, classId, plan, level)
  const personalId = personalSkillId(state, unitId)

  const picker: SkillPickerVM | null = state.skillSheet?.unitId === unitId ? buildPicker(state, unitId, pool, plan) : null

  const inheritance = buildInheritance(state, unitId, row.fixedParent, variableParentId)

  const warnings: WarningVM[] = []
  if (!state.dlc && hiddenDlc > 0) {
    warnings.push({
      id: 'dlc-off-pool',
      message: `${hiddenDlc} DLC classes are hidden while DLC is off.`,
      actionLabel: 'Turn DLC on',
      onAction: () => protoActions.toggleDlc(),
    })
  }
  for (const skillId of plan.skills) {
    if (skillId === null) continue
    const entry = pool.find((candidate) => candidate.id === skillId && !candidate.reached)
    if (entry && entry.classId > 0) {
      warnings.push({
        id: `unreachable-${skillId}`,
        message: `${entry.name} needs ${className(entry.classId)} ${entry.level} — not on the route.`,
        actionLabel: 'Add stop',
        onAction: () => protoActions.addStop(unitId, entry.classId, 'own'),
      })
    }
  }
  if (unitId === 'PID_シノノメ' && plan.route.some((stop) => stop.classId === 43) && plan.route.some((stop) => stop.classId === 71)) {
    warnings.push({
      id: 'illegal-transition',
      message: ROUTE_ILLEGAL_WARNING.message,
      actionLabel: 'Open route',
      onAction: () => navigate({ name: 'unit-route', unitId }),
    })
  }

  const partnerId = plan.combatPartner
  const combatSheet: CombatSheetVM | null =
    state.combatSheet === unitId
      ? {
          unitId,
          options: rosterIds(state)
            .filter((id) => id !== unitId)
            .map((id) => ({
              id,
              name: unitRow(id)?.name ?? id,
              sprite: spriteFor(id),
              current: plan.combatPartner === id,
              onPick: () => protoActions.setCombatPartner(unitId, id),
            })),
          onClear: () => protoActions.setCombatPartner(unitId, null),
          onClose: () => protoActions.closeCombatSheet(),
        }
      : null

  const fixedParentId = row.fixedParent
  const parentLabel = (parentId?: string): 'Dad' | 'Mum' =>
    parentId && unitRow(parentId)?.gender === 'female' ? 'Mum' : 'Dad'

  const relationships: UnitVM['relationships'] = []
  if (fixedParentId) {
    relationships.push({
      id: 'fixed-parent',
      label: parentLabel(fixedParentId),
      value: unitRow(fixedParentId)?.name ?? fixedParentId,
      tone: 'fixed',
    })
  }
  if (variableParentId || fixedParentId) {
    relationships.push({
      id: 'variable-parent',
      label: 'Parent',
      value: variableParentId ? (unitRow(variableParentId)?.name ?? variableParentId) : 'unset',
      tone: 'accent',
      onOpen: () => protoActions.openPartnerSheet(unitId, 'Parent'),
    })
  }
  relationships.push({
    id: 's-partner',
    label: 'S',
    value: plan.sPartner ? (unitRow(plan.sPartner)?.name ?? plan.sPartner) : 'unset',
    rank: 'S',
    tone: plan.sPartner ? 'accent' : 'plain',
    onOpen: () => protoActions.openPartnerSheet(unitId, 'S'),
  })
  relationships.push({
    id: 'a-plus',
    label: 'A+',
    value: plan.aPlusPartner ? (unitRow(plan.aPlusPartner)?.name ?? plan.aPlusPartner) : 'unset',
    rank: 'A+',
    tone: plan.aPlusPartner ? 'accent' : 'plain',
    onOpen: () => protoActions.openPartnerSheet(unitId, 'A+'),
  })
  relationships.push({
    id: 'combat',
    label: plan.combatRole === 'front' ? 'Front' : 'Back',
    value: partnerId ? `w/ ${unitRow(partnerId)?.name ?? partnerId}` : 'pick partner',
    tone: partnerId ? 'accent' : 'plain',
    onOpen: () => protoActions.openCombatSheet(unitId),
  })

  return {
    id: unitId,
    name: row.name,
    sprite: spriteFor(unitId),
    className: className(classId),
    levelLabel: `Lv ${plan.levelFrom ?? 1} → ${plan.levelTo ?? 20}`,
    isChild: Boolean(fixedParentId),
    relationships,
    classGroups,
    compare,
    stats,
    skills: {
      slots: plan.skills.map((skillId, slot) => ({
        slot,
        skill:
          skillId === null
            ? null
            : {
                id: skillId,
                name: skillName(skillId),
                short: skillShort(skillId),
                source: skillSourceLabel(pool, plan, skillId),
              },
        onOpen: () => protoActions.openSkillSheet(unitId, slot),
        onClear: () => protoActions.equipSkill(unitId, slot, null),
      })),
      personal: { id: personalId, name: skillName(personalId), short: skillShort(personalId) },
      onOpenPicker: (slot) => protoActions.openSkillSheet(unitId, slot),
    },
    skillPicker: picker,
    inheritance,
    combat: {
      partnerName: partnerId ? (unitRow(partnerId)?.name ?? partnerId) : null,
      role: plan.combatRole,
      onSetRole: (role) => protoActions.setCombatRole(unitId, role),
      onOpenPartnerPicker: () => protoActions.openCombatSheet(unitId),
    },
    combatSheet,
    partnerSheet: partnerSheetFor(state),
    warnings,
    onOpenRoute: () => navigate({ name: 'unit-route', unitId }),
    onBack: () => navigate({ name: 'pairings' }),
  }
}

function buildStats(
  state: ProtoState,
  unitId: string,
  classId: number,
  plan: ReturnType<typeof planFor>,
  level: number,
): UnitVM['stats'] {
  const row = unitRow(unitId)!
  const cls = classRow(classId)
  const personal = personalGrowths(unitId, plan.variableParent)
  const classGrowths = cls?.growths ?? [0, 0, 0, 0, 0, 0, 0, 0]
  const caps = projectedStats(unitId, classId, level)
  const useReference = unitId === 'PID_シノノメ' && classId === 71 && level === 20
  const partnerId = plan.combatPartner
  const partnerCls = partnerId ? classRow(planFor(state, partnerId).classId ?? 0) : undefined
  const delta = plan.combatRole === 'front' ? (PAIRUP_DELTAS[unitId] ?? partnerCls?.pairUp) : undefined

  const rows: StatRowVM[] = STAT_KEYS_ORDER.map((key: StatKey, index) => {
    const override = useReference ? SHIRO_STATS[index] : null
    const projected = caps[index]
    return {
      key,
      label: key.toUpperCase(),
      value: override ? override.value : projected?.value ?? 0,
      personalGrowth: override ? override.personal : personal[index],
      classGrowth: override ? override.classGrowth : classGrowths[index],
      cap: override ? override.cap : projected?.cap ?? 0,
      capMod: row.capMods[index],
      delta: override?.delta ?? delta?.[index],
    }
  })

  return {
    level,
    levels: [10, 15, 20],
    onSetLevel: (next) => protoActions.setStatLevel(next),
    rows,
    partnerNote: partnerId ? `Pair-up deltas from ${unitRow(partnerId)?.name ?? partnerId} · ${plan.combatRole} role` : null,
  }
}

function buildPicker(
  state: ProtoState,
  unitId: string,
  pool: PoolSkill[],
  plan: ReturnType<typeof planFor>,
): SkillPickerVM {
  const slot = state.skillSheet?.slot ?? 0
  const equipped = plan.skills.filter((id): id is number => id !== null)
  const options: SkillOptionVM[] = pool.map((entry) => ({
    id: entry.id,
    name: entry.name,
    short: entry.short,
    source: entry.sourceLabel,
    classId: entry.classId,
    dlc: entry.dlc,
    reached: entry.reached,
    equipped: equipped.includes(entry.id),
    onPick: () => protoActions.equipSkill(unitId, slot, entry.id),
    onAddStop: entry.classId > 0 && !entry.reached ? () => protoActions.addStop(unitId, entry.classId, 'own') : undefined,
  }))

  const groups: SkillPickerVM['groups'] = []
  const personal = options.filter((option) => option.source === 'Personal')
  if (personal.length > 0) groups.push({ id: 'personal', label: 'Personal skill', options: personal })
  for (const group of poolGroups(unitId)) {
    const groupOptions = options.filter((option) => group.classIds.includes(option.classId))
    if (groupOptions.length === 0) continue
    if (group.source === 'dlc' && !state.dlc) continue
    groups.push({ id: group.label, label: group.label, options: groupOptions })
  }

  return {
    slot,
    options,
    groups,
    onClearSlot: () => protoActions.equipSkill(unitId, slot, null),
    onClose: () => protoActions.closeSkillSheet(),
  }
}

function buildInheritance(
  state: ProtoState,
  unitId: string,
  fixedParentId: string | undefined,
  variableParentId: string | undefined,
): InheritanceVM | null {
  if (!fixedParentId) return null
  const plan = planFor(state, unitId)
  const fixedPlan = planFor(state, fixedParentId)
  const variablePlan = variableParentId ? planFor(state, variableParentId) : null
  const lastSkill = (skills: (number | null)[]): number | undefined => [...skills].reverse().find((id): id is number => id !== null)
  const fixedSkillId = plan.inherit?.fixed ?? lastSkill(fixedPlan.skills)
  const variableSkillId = plan.inherit?.variable ?? (variablePlan ? lastSkill(variablePlan.skills) : undefined)
  const branch = (parentId: string | undefined): string => {
    if (!parentId) return '—'
    const parent = unitRow(parentId)
    const base = parent?.classes[parent.classes.length - 1]
    return base ? className(base) : '—'
  }
  const toSkill = (skillId: number | undefined) =>
    skillId ? { id: skillId, name: skillName(skillId), short: skillShort(skillId) } : null
  return {
    rule: 'A child inherits the last equipped skill of each parent.',
    fixedParent: {
      name: fixedParentId ? (unitRow(fixedParentId)?.name ?? fixedParentId) : '—',
      sprite: fixedParentId ? spriteFor(fixedParentId) : { label: '?' },
      skill: toSkill(fixedSkillId),
    },
    variableParent: {
      name: variableParentId ? (unitRow(variableParentId)?.name ?? variableParentId) : 'unset',
      sprite: variableParentId ? spriteFor(variableParentId) : { label: '?' },
      skill: toSkill(variableSkillId),
    },
    branches: [branch(fixedParentId), branch(variableParentId)].filter((name) => name !== '—'),
  }
}
