import type { Dataset, Route, UnitDef } from '../data/types'
import type { ClassStop, ClassRouteVia } from '../state/model'
import type { ClassPoolEntry } from './classes'
import { skillPool } from './skills'

export const MASTER_SEAL_MIN_LEVEL = 10
export const ETERNAL_SEAL_LEVEL_INCREASE = 5
export const MAX_CHARACTER_LEVEL = 99

export interface ClassRouteIssue {
  id: string
  index: number
  severity: 'error' | 'warning'
  message: string
}

export interface ClassRouteValidationOptions {
  classPool: ClassPoolEntry[]
  dlcEnabled: boolean
  chapterTarget?: number
}

export interface RouteSkillLearning {
  classId: number
  level: number
  stopIndex: number
  onArrival: boolean
}

export interface RouteStopLevelUpdate {
  fromLevel?: number
  toLevel?: number
}

export function classLevelCap(classTier: 'base' | 'promoted' | 'special', eternalSeals = 0): number {
  const classCap = classTier === 'special' ? 40 : 20
  return Math.min(MAX_CHARACTER_LEVEL, classCap + Math.max(0, eternalSeals) * ETERNAL_SEAL_LEVEL_INCREASE)
}

export function levelAfterClassChange(
  fromTier: 'base' | 'promoted' | 'special',
  toTier: 'base' | 'promoted' | 'special',
  level: number,
): number {
  if (fromTier === 'promoted' && toTier === 'special') return level + 20
  if (fromTier === 'special' && toTier === 'promoted') return level - 20
  return level
}

export function viaForClassSource(source: ClassPoolEntry['branch'] | 'dlc'): ClassRouteVia {
  if (source === 'parent') return 'offspring'
  if (source === 'seal') return 'partner'
  if (source === 'aplus') return 'friendship'
  if (source === 'dlc') return 'dlc'
  return 'heart'
}

export function routeSealLabel(via: ClassRouteVia): string {
  switch (via) {
    case 'start': return 'Starting class'
    case 'promotion':
    case 'master': return 'Master Seal'
    case 'heart': return 'Heart Seal'
    case 'partner': return 'Partner Seal'
    case 'friendship': return 'Friendship Seal'
    case 'eternal': return 'Eternal Seal · +5 cap'
    case 'offspring': return 'Offspring Seal'
    case 'dlc': return 'DLC Seal'
  }
}

function promotionFrom(previousClassId: number, nextClassId: number, dataset: Dataset): boolean {
  const previous = dataset.classesById.get(previousClassId)
  const next = dataset.classesById.get(nextClassId)
  return Boolean(previous?.tier === 'base' && next?.tier === 'promoted' && previous.promotesTo.includes(nextClassId))
}

export function appendClassRouteStop(
  dataset: Dataset,
  route: ClassStop[],
  classId: number,
  via: ClassRouteVia,
): ClassStop[] {
  const targetClass = dataset.classesById.get(classId)
  if (!targetClass) return route

  if (route.length === 0) {
    return [{ classId, fromLevel: 1, toLevel: classLevelCap(targetClass.tier), via: 'start' }]
  }

  const previousStop = route[route.length - 1]
  const previousClass = dataset.classesById.get(previousStop.classId)
  if (!previousClass) return route

  if (via === 'eternal') {
    const sealsUsed = route.filter((stop) => stop.via === 'eternal').length
    const newCap = classLevelCap(targetClass.tier, sealsUsed + 1)
    return [...route, {
      classId,
      fromLevel: previousStop.toLevel,
      toLevel: Math.min(newCap, previousStop.toLevel + ETERNAL_SEAL_LEVEL_INCREASE),
      via,
    }]
  }

  if (promotionFrom(previousStop.classId, classId, dataset)) {
    const previous = { ...previousStop, toLevel: Math.max(previousStop.toLevel, MASTER_SEAL_MIN_LEVEL) }
    return [
      ...route.slice(0, -1),
      previous,
      { classId, fromLevel: 1, toLevel: classLevelCap(targetClass.tier, route.filter((stop) => stop.via === 'eternal').length), via: 'master' },
    ]
  }

  const level = levelAfterClassChange(previousClass.tier, targetClass.tier, previousStop.toLevel)
  const sealsUsed = route.filter((stop) => stop.via === 'eternal').length
  return [...route, {
    classId,
    fromLevel: Math.max(1, level),
    toLevel: classLevelCap(targetClass.tier, sealsUsed),
    via,
  }]
}

export function updateRouteStopLevels(
  route: ClassStop[],
  index: number,
  update: RouteStopLevelUpdate,
): ClassStop[] {
  if (index < 0 || index >= route.length) return route
  return route.map((stop, stopIndex) => stopIndex === index ? { ...stop, ...update } : stop)
}

export function setRouteStopEndLevel(
  dataset: Dataset,
  route: ClassStop[],
  index: number,
  toLevel: number,
): ClassStop[] {
  if (index < 0 || index >= route.length) return route
  let updated = updateRouteStopLevels(route, index, { toLevel })

  for (let stopIndex = index + 1; stopIndex < updated.length; stopIndex += 1) {
    const previous = updated[stopIndex - 1]
    const current = updated[stopIndex]
    const previousClass = dataset.classesById.get(previous.classId)
    const currentClass = dataset.classesById.get(current.classId)
    if (!previousClass || !currentClass) continue

    const fromLevel = current.via === 'master' || current.via === 'promotion'
      ? 1
      : current.via === 'eternal'
        ? previous.toLevel
        : levelAfterClassChange(previousClass.tier, currentClass.tier, previous.toLevel)
    updated = updateRouteStopLevels(updated, stopIndex, { fromLevel })
  }

  return updated
}

export function validateClassRoute(
  dataset: Dataset,
  route: ClassStop[],
  options: ClassRouteValidationOptions,
): ClassRouteIssue[] {
  const issues: ClassRouteIssue[] = []
  let eternalSealsUsed = 0

  route.forEach((stop, index) => {
    const currentClass = dataset.classesById.get(stop.classId)
    if (!currentClass) {
      issues.push({ id: `missing-class-${index}`, index, severity: 'error', message: `Class ${stop.classId} is missing from this data pack.` })
      return
    }

    if (!Number.isInteger(stop.fromLevel) || !Number.isInteger(stop.toLevel) || stop.fromLevel < 1 || stop.toLevel < stop.fromLevel) {
      issues.push({ id: `level-range-${index}`, index, severity: 'error', message: `${currentClass.name} needs a valid level range.` })
    }

    const isEternalUse = stop.via === 'eternal'
    if (isEternalUse) eternalSealsUsed += 1
    const cap = classLevelCap(currentClass.tier, eternalSealsUsed)
    if (stop.toLevel > cap) {
      issues.push({ id: `level-cap-${index}`, index, severity: 'error', message: `${currentClass.name} is capped at Lv ${cap} on this route.` })
    }

    if (currentClass.dlc && !options.dlcEnabled) {
      issues.push({ id: `dlc-off-${index}`, index, severity: 'warning', message: `${currentClass.name} is a DLC class while DLC is off.` })
    }

    if (stop.via === 'offspring' && options.chapterTarget === undefined) {
      issues.push({
        id: `offspring-chapter-${index}`,
        index,
        severity: 'warning',
        message: `Offspring Seal level and stat gains depend on the recruitment chapter; no chapter target is set.`,
      })
    }

    if (index === 0) {
      if (stop.via !== 'start') {
        issues.push({ id: 'route-start-via', index, severity: 'error', message: `The first class must be the starting class.` })
      }
      if (stop.fromLevel !== 1) {
        issues.push({ id: 'route-start-level', index, severity: 'error', message: `The starting class begins at Lv 1.` })
      }
      const ownStart = options.classPool.some((entry) => entry.classId === stop.classId && entry.branch === 'own')
      if (!ownStart) {
        issues.push({ id: 'route-start-unavailable', index, severity: 'error', message: `${currentClass.name} is not in this unit's own starting class set.` })
      }
      if (isEternalUse) {
        issues.push({ id: 'eternal-no-previous-stop', index, severity: 'error', message: `An Eternal Seal needs an existing class at its level cap.` })
      }
      return
    }

    const previousStop = route[index - 1]
    const previousClass = dataset.classesById.get(previousStop.classId)
    if (!previousClass) return

    if (isEternalUse) {
      const previousCap = classLevelCap(previousClass.tier, eternalSealsUsed - 1)
      if (currentClass.tier === 'base') {
        issues.push({ id: `eternal-base-${index}`, index, severity: 'error', message: `Eternal Seals are only usable after a promoted or special class reaches its level cap.` })
      }
      if (previousClass.id !== currentClass.id) {
        issues.push({ id: `eternal-class-${index}`, index, severity: 'error', message: `An Eternal Seal raises the cap while staying in the same class.` })
      }
      if (previousStop.toLevel !== previousCap) {
        issues.push({ id: `eternal-max-${index}`, index, severity: 'error', message: `The previous class must reach Lv ${previousCap} before using an Eternal Seal.` })
      }
      if (stop.fromLevel !== previousStop.toLevel) {
        issues.push({ id: `eternal-carry-${index}`, index, severity: 'error', message: `An Eternal Seal keeps the current level.` })
      }
      if (stop.toLevel <= stop.fromLevel) {
        issues.push({ id: `eternal-increase-${index}`, index, severity: 'error', message: `An Eternal Seal stop must progress above the previous level.` })
      }
      return
    }

    const isPromotion = promotionFrom(previousClass.id, currentClass.id, dataset)
    if (isPromotion) {
      if (stop.via !== 'master' && stop.via !== 'promotion') {
        issues.push({ id: `promotion-seal-${index}`, index, severity: 'error', message: `${currentClass.name} is a promotion from ${previousClass.name} and needs a Master Seal.` })
      }
      if (previousStop.toLevel < MASTER_SEAL_MIN_LEVEL) {
        issues.push({ id: `promotion-level-${index}`, index, severity: 'error', message: `A Master Seal promotion needs ${previousClass.name} at Lv ${MASTER_SEAL_MIN_LEVEL} or higher.` })
      }
      if (stop.fromLevel !== 1) {
        issues.push({ id: `promotion-reset-${index}`, index, severity: 'error', message: `Master Seal promotion resets the new class to Lv 1.` })
      }
      return
    }

    if (stop.via === 'master' || stop.via === 'promotion') {
      issues.push({ id: `not-promotion-${index}`, index, severity: 'error', message: `${currentClass.name} is not a promotion from ${previousClass.name}.` })
    }

    const routeEntry = options.classPool.find((entry) => entry.classId === currentClass.id)
    const isDlcClass = currentClass.dlc && stop.via === 'dlc'
    if (!routeEntry && !isDlcClass) {
      issues.push({ id: `class-unavailable-${index}`, index, severity: 'error', message: `${currentClass.name} is not available in this unit's class pool.` })
    } else if (!isDlcClass) {
      const expectedVia = routeEntry ? viaForClassSource(routeEntry.branch) : null
      if (expectedVia && stop.via !== expectedVia) {
        issues.push({ id: `seal-source-${index}`, index, severity: 'error', message: `${currentClass.name} needs the ${routeSealLabel(expectedVia)} for its selected class source.` })
      }
    }

    if (stop.via === 'dlc' && !currentClass.dlc) {
      issues.push({ id: `not-dlc-${index}`, index, severity: 'error', message: `${currentClass.name} is not a DLC class.` })
    }

    const expectedLevel = levelAfterClassChange(previousClass.tier, currentClass.tier, previousStop.toLevel)
    if (expectedLevel < 1) {
      issues.push({ id: `level-mapping-${index}`, index, severity: 'error', message: `The level mapping from ${previousClass.name} would fall below Lv 1.` })
    } else if (stop.fromLevel !== expectedLevel) {
      issues.push({
        id: `level-carry-${index}`,
        index,
        severity: 'error',
        message: `${routeSealLabel(stop.via)} carries Lv ${expectedLevel} into ${currentClass.name}.`,
      })
    }
  })

  return issues
}

export function skillLearningOnRoute(
  dataset: Dataset,
  unit: UnitDef,
  classPool: ClassPoolEntry[],
  route: ClassStop[],
  routeId: Route,
  skillId: number,
): RouteSkillLearning | null {
  const available = skillPool(dataset, unit, classPool, routeId).some((entry) => entry.skillId === skillId)
  if (!available) return null

  for (let stopIndex = 0; stopIndex < route.length; stopIndex += 1) {
    const stop = route[stopIndex]
    const classDef = dataset.classesById.get(stop.classId)
    const learn = classDef?.skillLearn.find((entry) => entry.id === skillId)
    if (classDef && learn && learn.level <= stop.toLevel) {
      return {
        classId: classDef.id,
        level: learn.level,
        stopIndex,
        onArrival: learn.level <= stop.fromLevel,
      }
    }
  }
  return null
}
