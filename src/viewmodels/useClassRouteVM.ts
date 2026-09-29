import { assetUrl } from '../data/assets'
import { useDataset } from '../data/useDataset'
import { className, skillName } from '../data/types'
import { primaryBaseClass, classPool, type ClassPoolEntry } from '../logic/classes'
import {
  appendClassRouteStop,
  classLevelCap,
  routeSealLabel,
  setRouteStopEndLevel,
  skillLearningOnRoute,
  validateClassRoute,
  viaForClassSource,
} from '../logic/classRoute'
import { skillPool } from '../logic/skills'
import { navigate } from '../lib/router'
import { emptyUnitPlan } from '../state/model'
import { usePlansStore } from '../state/store'
import { usePlannerUiStore } from '../state/uiStore'
import type { ClassStop, ClassRouteVia } from '../state/model'
import type { Dataset, UnitDef } from '../data/types'
import type { AddStopOptionVM, ClassRouteVM, RouteStopVM, WarningVM } from './types'

interface RouteClassOption extends ClassPoolEntry {
  source: ClassPoolEntry['branch'] | 'dlc'
}

function skillShort(name: string): string {
  const initials = name.split(/\s+/).filter(Boolean).map((word) => word[0]).join('').toUpperCase()
  return initials.slice(0, 2) || name.slice(0, 2).toUpperCase()
}

function classOptions(dataset: Dataset, unit: UnitDef, pool: ClassPoolEntry[]): RouteClassOption[] {
  const options: RouteClassOption[] = pool.map((entry) => ({ ...entry, source: entry.branch }))
  const seen = new Set(options.map((entry) => entry.classId))
  for (const gameClass of dataset.classes) {
    if (!gameClass.dlc || seen.has(gameClass.id)) continue
    if (gameClass.name.endsWith('(M)') && unit.gender !== 'male') continue
    if (gameClass.name.endsWith('(F)') && unit.gender !== 'female') continue
    options.push({ classId: gameClass.id, branch: 'own', source: 'dlc', sourceLabel: 'DLC class set' })
    seen.add(gameClass.id)
  }
  return options
}

function primaryStartStop(dataset: Dataset, unit: UnitDef, targetClassId: number): ClassStop | null {
  const primaryId = primaryBaseClass(dataset, unit)
  if (primaryId === null) return null
  const primary = dataset.classesById.get(primaryId)
  if (!primary) return null
  const cap = classLevelCap(primary.tier)
  return {
    classId: primaryId,
    fromLevel: 1,
    toLevel: primaryId === targetClassId ? cap : primary.tier === 'base' ? 10 : cap,
    via: 'start',
  }
}

function nextVia(
  dataset: Dataset,
  route: ClassStop[],
  option: RouteClassOption,
): ClassRouteVia {
  const previous = route[route.length - 1]
  const previousClass = previous ? dataset.classesById.get(previous.classId) : undefined
  const target = dataset.classesById.get(option.classId)
  if (previousClass?.tier === 'base' && target?.tier === 'promoted' && previousClass.promotesTo.includes(option.classId)) {
    return 'master'
  }
  return viaForClassSource(option.source)
}

function sourceForStop(pool: ClassPoolEntry[], stop: ClassStop, dlc: boolean): string {
  if (dlc) return 'DLC class set'
  return pool.find((entry) => entry.classId === stop.classId)?.sourceLabel ?? 'Class pool'
}

function selectUnit(dataset: Dataset | null, runRoute: string, unitId: string): UnitDef | undefined {
  if (!dataset) return undefined
  const direct = dataset.unitsById.get(unitId)
  if (direct) return direct
  return dataset.units.find((unit) => unit.routes.includes(runRoute as UnitDef['routes'][number]))
}

function uniqueDlcClasses(routeOptions: RouteClassOption[]): RouteClassOption[] {
  const seen = new Set<number>()
  return routeOptions.filter((entry) => {
    if (seen.has(entry.classId)) return false
    seen.add(entry.classId)
    return true
  })
}

export function useClassRouteVM(unitId: string): ClassRouteVM {
  const store = usePlansStore()
  const ui = usePlannerUiStore()
  const run = store.runs.find((candidate) => candidate.id === store.activeRunId) ?? store.runs[0]
  const { data } = useDataset(run?.modpackId ?? 'ugf-2.5.2')
  const unit = selectUnit(data, run?.route ?? 'revelation', unitId)
  const selectedUnitId = unit?.id ?? unitId
  const plan = run?.units[selectedUnitId] ?? emptyUnitPlan()
  const fixedParent = unit?.fixedParent ? data?.unitsById.get(unit.fixedParent) : undefined
  const pool = data && unit
    ? classPool(data, unit, {
        variableParent: plan.variableParent ? data.unitsById.get(plan.variableParent) ?? null : null,
        sPartner: plan.sPartner ? data.unitsById.get(plan.sPartner) ?? null : null,
        aPlusPartner: plan.aPlusPartner ? data.unitsById.get(plan.aPlusPartner) ?? null : null,
        corrinTalentClassId: run?.corrin.talentClassId,
        fixedParentIsCorrin: Boolean(fixedParent?.isCorrin),
      })
    : []
  const routeOptions = data && unit ? uniqueDlcClasses(classOptions(data, unit, pool)) : []
  const candidateSkills = data && unit && run
    ? skillPool(data, unit, routeOptions, run.route)
    : []
  const unitName = unit?.name ?? unitId

  const stops: RouteStopVM[] = data && unit
    ? plan.classRoute.map((stop, index) => {
        const gameClass = data.classesById.get(stop.classId)
        const gameClassName = className(data, stop.classId)
        const learned = new Set<number>()
        for (const earlier of plan.classRoute.slice(0, index)) {
          const earlierClass = data.classesById.get(earlier.classId)
          for (const learn of earlierClass?.skillLearn ?? []) {
            if (learn.level <= earlier.toLevel) learned.add(learn.id)
          }
        }
        const skills = (gameClass?.skillLearn ?? [])
          .filter((learn) => learn.level <= stop.toLevel && !learned.has(learn.id))
          .map((learn) => {
            const name = skillName(data, learn.id)
            return {
              id: learn.id,
              name,
              short: skillShort(name),
              learnLabel: learn.level <= stop.fromLevel ? 'on arrival' : `· Lv ${learn.level}`,
            }
          })
        const source = sourceForStop(pool, stop, Boolean(gameClass?.dlc))
        const eternalSealsUsed = plan.classRoute.slice(0, index + 1).filter((entry) => entry.via === 'eternal').length
        return {
          id: `${stop.classId}-${index}`,
          classId: stop.classId,
          name: gameClassName,
          sprite: { label: gameClassName, src: assetUrl('class', stop.classId) },
          fromLevel: stop.fromLevel,
          toLevel: stop.toLevel,
          maxLevel: gameClass?.tier === 'base' ? 20 : classLevelCap(gameClass?.tier ?? 'base', eternalSealsUsed),
          seal: `${routeSealLabel(stop.via)} · ${source}`,
          done: index < plan.classRoute.length - 1,
          dlc: Boolean(gameClass?.dlc),
          skills,
          onSetToLevel: (toLevel) => {
            if (!run) return
            store.updateUnit(run.id, selectedUnitId, (current) => ({
              ...current,
              classRoute: setRouteStopEndLevel(data, current.classRoute, index, toLevel),
            }))
          },
          onRemove: () => {
            if (!run) return
            store.updateUnit(run.id, selectedUnitId, (current) => ({
              ...current,
              classRoute: current.classRoute.filter((_, stopIndex) => stopIndex !== index),
            }))
          },
        }
      })
    : []

  const warnings: WarningVM[] = []
  if (data && unit && run) {
    const issues = validateClassRoute(data, plan.classRoute, {
      classPool: routeOptions,
      dlcEnabled: run.dlc,
    })
    for (const issue of issues) {
      warnings.push({
        id: `route-${issue.id}`,
        message: issue.message,
        ...(issue.id.startsWith('dlc-off-')
          ? { actionLabel: 'Turn DLC on', onAction: () => store.updateRun(run.id, { dlc: true }) }
          : {}),
      })
    }

    const personalSkill = unit.personalSkills[run.route] ?? unit.personalSkills.revelation ??
      unit.personalSkills.birthright ?? unit.personalSkills.conquest
    const selectedSkills = [...new Set(plan.skills.filter((skillId): skillId is number => skillId !== null))]
    for (const skillId of selectedSkills) {
      if (skillId === personalSkill || skillId === plan.inheritSkill) continue
      const candidate = candidateSkills.find((entry) => entry.skillId === skillId)
      if (!candidate) {
        warnings.push({
          id: `skill-unavailable-${skillId}`,
          message: `${skillName(data, skillId)} is not available in this unit's current class pool.`,
          actionLabel: 'Add stop',
          onAction: () => ui.setAddStopOpen(true),
        })
        continue
      }
      const reached = skillLearningOnRoute(data, unit, routeOptions, plan.classRoute, run.route, skillId)
      if (!reached) {
        const sourceClass = candidate.classId === undefined ? undefined : data.classesById.get(candidate.classId)
        const requirement = sourceClass && candidate.level !== undefined
          ? `${sourceClass.name} Lv ${candidate.level}`
          : candidate.label
        warnings.push({
          id: `skill-unreached-${skillId}`,
          message: `${skillName(data, skillId)} needs ${requirement}; the current route does not reach it.`,
          actionLabel: 'Add stop',
          onAction: () => ui.setAddStopOpen(true),
        })
      }
    }
  }

  const used = new Set(plan.classRoute.map((stop) => stop.classId))
  const addStopOptions: AddStopOptionVM[] = []
  if (data && unit) {
    for (const option of routeOptions) {
      if (used.has(option.classId)) continue
      const gameClass = data.classesById.get(option.classId)
      if (!gameClass) continue
      if (gameClass.dlc && !run?.dlc) continue
      const via = nextVia(data, plan.classRoute, option)
      const displaySeal = plan.classRoute.length === 0 && option.classId === primaryBaseClass(data, unit)
        ? 'Starting class'
        : routeSealLabel(via)
      const candidateSource = option.source === 'dlc' ? 'DLC class set' : option.sourceLabel
      addStopOptions.push({
        classId: option.classId,
        name: gameClass.name,
        sprite: { label: gameClass.name, src: assetUrl('class', gameClass.id) },
        source: option.source,
        sourceLabel: candidateSource,
        seal: displaySeal,
        dlc: gameClass.dlc,
        onPick: () => {
          if (!run) return
          store.updateUnit(run.id, selectedUnitId, (current) => {
            let route = current.classRoute
            if (route.length === 0) {
              const start = primaryStartStop(data, unit, option.classId)
              route = start ? [start] : []
              if (start?.classId === option.classId) {
                return { ...current, classRoute: route }
              }
            }
            return {
              ...current,
              classRoute: appendClassRouteStop(data, route, option.classId, nextVia(data, route, option)),
            }
          })
          ui.setAddStopOpen(false)
        },
      })
    }

    const lastStop = plan.classRoute[plan.classRoute.length - 1]
    const lastClass = lastStop ? data.classesById.get(lastStop.classId) : undefined
    const eternalCount = plan.classRoute.filter((stop) => stop.via === 'eternal').length
    if (lastStop && lastClass && lastClass.tier !== 'base' && (run?.dlc || !lastClass.dlc)) {
      const cap = classLevelCap(lastClass.tier, eternalCount)
      if (lastStop.toLevel === cap && cap < 99) {
        addStopOptions.unshift({
          classId: lastClass.id,
          name: lastClass.name,
          sprite: { label: lastClass.name, src: assetUrl('class', lastClass.id) },
          source: 'eternal',
          sourceLabel: 'Current class',
          seal: routeSealLabel('eternal'),
          dlc: lastClass.dlc,
          onPick: () => {
            if (!run) return
            store.updateUnit(run.id, selectedUnitId, (current) => ({
              ...current,
              classRoute: appendClassRouteStop(data, current.classRoute, lastClass.id, 'eternal'),
            }))
            ui.setAddStopOpen(false)
          },
        })
      }
    }
  }

  return {
    unit: {
      id: selectedUnitId,
      name: unitName,
      sprite: { label: unitName, src: unit ? assetUrl('unit', unit.id) : undefined },
    },
    stops,
    warnings,
    addStopOpen: ui.addStopOpen,
    addStopOptions,
    onOpenAddStop: () => ui.setAddStopOpen(true),
    onCloseAddStop: () => ui.setAddStopOpen(false),
    onOpenUnit: () => navigate({ name: 'unit', unitId: selectedUnitId }),
    onBack: () => navigate({ name: 'unit', unitId: selectedUnitId }),
  }
}
