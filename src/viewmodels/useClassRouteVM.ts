import { navigate } from '../lib/router'
import { classRow, className, learnLevel, poolGroups, shortSkill, skillName, unitRow, viaForStop } from '../prototype/derive'
import { PROTO_CLASSES, ROSTER_IDS, ROUTE_ILLEGAL_WARNING, ROUTE_SKILL_WARNING, WANTED_SKILLS } from '../prototype/fixtures'
import { planFor, protoActions, useProtoState } from '../prototype/state'
import type { AddStopOptionVM, ClassRouteVM, RouteStopVM, WarningVM } from './types'
import { classSprite, spriteFor } from './shared'

export function useClassRouteVM(unitId: string): ClassRouteVM {
  const state = useProtoState()
  const row = unitRow(unitId) ?? unitRow(ROSTER_IDS[0])!
  const plan = planFor(state, unitId)

  const stops: RouteStopVM[] = plan.route.map((stop, index) => {
    const cls = classRow(stop.classId)
    const skills = (cls?.skills ?? []).map((skillId, skillIndex) => {
      const learn = learnLevel(cls?.tier ?? 'base', skillIndex)
      return {
        id: skillId,
        name: skillName(skillId),
        short: shortSkill(skillName(skillId)),
        learn,
        learnLabel: stop.fromLevel > 1 && learn <= stop.fromLevel ? 'on arrival' : `· ${learn}`,
      }
    })
    return {
      id: `${stop.classId}-${index}`,
      classId: stop.classId,
      name: className(stop.classId),
      sprite: classSprite(stop.classId),
      fromLevel: stop.fromLevel,
      toLevel: stop.toLevel,
      seal: viaForStop(stop),
      done: index < plan.route.length - 1,
      dlc: Boolean(PROTO_CLASSES[stop.classId]?.dlc),
      skills: skills.filter((skill) => skill.learn <= stop.toLevel),
      onRemove: () => protoActions.removeStop(unitId, index),
    }
  })

  const warnings: WarningVM[] = []
  for (const skillId of WANTED_SKILLS[unitId] ?? []) {
    const inPool = poolGroups(unitId).some((group) =>
      group.classIds.some((classId) => classRow(classId)?.skills.includes(skillId)),
    )
    if (!inPool) continue
    warnings.push({
      id: `wanted-${skillId}`,
      message: `${skillName(skillId)} is wanted but no stop reaches ${className(ROUTE_SKILL_WARNING.classId)} ${ROUTE_SKILL_WARNING.level}.`,
      actionLabel: 'Add stop',
      onAction: () => protoActions.addStop(unitId, ROUTE_SKILL_WARNING.classId, 'own'),
    })
  }
  if (
    plan.route.some((stop) => stop.classId === 43) &&
    plan.route.some((stop) => stop.classId === 71) &&
    plan.route.findIndex((stop) => stop.classId === 71) > plan.route.findIndex((stop) => stop.classId === 43)
  ) {
    warnings.push({
      id: 'illegal-transition',
      message: ROUTE_ILLEGAL_WARNING.message,
    })
  }
  const dlcStop = plan.route.find((stop) => PROTO_CLASSES[stop.classId]?.dlc)
  if (dlcStop && !state.dlc) {
    warnings.push({
      id: 'dlc-stop',
      message: `${className(dlcStop.classId)} is a DLC class and DLC is off.`,
      actionLabel: 'Turn DLC on',
      onAction: () => protoActions.toggleDlc(),
    })
  }

  const used = new Set(plan.route.map((stop) => stop.classId))
  const addStopOptions: AddStopOptionVM[] = []
  for (const group of poolGroups(unitId)) {
    if (group.source === 'dlc' && !state.dlc) continue
    for (const classId of group.classIds) {
      if (used.has(classId) || addStopOptions.some((option) => option.classId === classId)) continue
      const cls = classRow(classId)
      if (!cls) continue
      addStopOptions.push({
        classId,
        name: cls.name,
        sprite: classSprite(classId),
        source: group.source,
        sourceLabel: group.label,
        seal: cls.dlc ? 'DLC seal' : cls.tier === 'promoted' ? 'Master Seal' : 'Heart Seal',
        dlc: Boolean(cls.dlc),
        onPick: () => protoActions.addStop(unitId, classId, group.source),
      })
    }
  }

  return {
    unit: { id: unitId, name: row.name, sprite: spriteFor(unitId) },
    stops,
    warnings,
    addStopOpen: state.addStopOpen,
    addStopOptions,
    onOpenAddStop: () => protoActions.openAddStop(),
    onCloseAddStop: () => protoActions.closeAddStop(),
    onOpenUnit: () => navigate({ name: 'unit', unitId }),
    onBack: () => navigate({ name: 'unit', unitId }),
  }
}
