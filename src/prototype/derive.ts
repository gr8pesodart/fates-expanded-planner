/**
 * Fixture-level derivations for display only. Real maths lands in src/logic/
 * during M1–M5; these functions are replaced when the hooks are wired.
 */
import type { ClassTier, StatKey } from '../data/types'
import type { FixtureClassGroup, FixtureStop } from './fixtures'
import { CLASS_POOLS, CONFLICTS, PROTO_CLASSES, PROTO_SKILLS, PROTO_UNITS, SEAL_LABELS } from './fixtures'
import type { ProtoClassRow, ProtoUnitRow } from './gameTables'

export function classRow(id: number): ProtoClassRow | undefined {
  return PROTO_CLASSES[id]
}

export function unitRow(id: string): ProtoUnitRow | undefined {
  return PROTO_UNITS[id]
}

export function skillName(id: number): string {
  return PROTO_SKILLS[id] ?? `Skill ${id}`
}

export function className(id: number): string {
  return PROTO_CLASSES[id]?.name ?? `Class ${id}`
}

export function shortSkill(name: string): string {
  const words = name.split(/[\s'-]+/).filter(Boolean)
  if (words.length >= 2) return words[0][0].toUpperCase() + words[1][0]
  return name.slice(0, 1).toUpperCase() + name.slice(1, 2)
}

export function tierLabel(tier: ClassTier): string {
  if (tier === 'promoted') return 'Promoted'
  if (tier === 'special') return 'Special'
  return 'Base'
}

/** Base classes learn at 1/10; promoted at 5/15; special at 1/10/25/35. */
export function learnLevel(tier: ClassTier, index: number): number {
  if (tier === 'special') return [1, 10, 25, 35][index] ?? 35
  if (tier === 'promoted') return [5, 15][index] ?? 15
  return [1, 10][index] ?? 10
}

export function growthTotal(growths: number[]): number {
  return growths.reduce((sum, v) => sum + v, 0)
}

export function bestStatIndex(growths: number[]): number {
  let best = 0
  for (let i = 1; i < growths.length; i += 1) if (growths[i] > growths[best]) best = i
  return best
}

export function poolGroups(unitId: string): FixtureClassGroup[] {
  const explicit = CLASS_POOLS[unitId]
  if (explicit) return explicit
  const row = unitRow(unitId)
  if (!row) return []
  const expand = (baseId: number): number[] => {
    const base = classRow(baseId)
    if (!base) return []
    const wanted = row.gender === 'male' ? '(F)' : '(M)'
    const promoted = base.promotesTo.filter((id) => {
      const cls = classRow(id)
      return cls ? !cls.name.endsWith(wanted) : false
    })
    return [baseId, ...promoted]
  }
  const groups: FixtureClassGroup[] = [
    { source: 'own', label: 'Own classes', classIds: row.classes.flatMap(expand) },
  ]
  const secondary = row.reclasses.flatMap(expand)
  if (secondary.length > 0) groups.push({ source: 'secondary', label: 'Secondary classes', classIds: secondary })
  groups.push({ source: 'dlc', label: 'DLC', classIds: row.gender === 'male' ? [118, 120, 124, 125, 127] : [119, 121, 123, 126, 127] })
  return groups
}

export function sealLabel(via: FixtureStop['via']): string {
  return SEAL_LABELS[via]
}

export function routeCoversStop(route: FixtureStop[], stop: FixtureStop): boolean {
  return route.some((s) => s.classId === stop.classId && s.toLevel >= stop.toLevel)
}

export function routeHasClass(route: FixtureStop[], classId: number, level: number): boolean {
  return route.some((s) => s.classId === classId && s.toLevel >= level)
}

export function capModsFor(row: ProtoUnitRow): number[] {
  return row.capMods.map((mod, i) => (i === 0 ? 0 : mod))
}

export interface ProjectedStat {
  value: number
  cap: number
}

/** Approximate projected average for the prototype (M3 replaces this). */
export function projectedStats(unitId: string, classId: number, level: number): ProjectedStat[] {
  const row = unitRow(unitId)
  const cls = classRow(classId)
  if (!row || !cls) return []
  const capMods = capModsFor(row)
  return cls.baseStats.map((base, i) => {
    const growth = row.growths[i] + cls.growths[i]
    const value = Math.max(1, base + row.baseStats[i] + Math.floor((growth * (level - 1)) / 100))
    const cap = Math.max(1, cls.caps[i] + capMods[i])
    return { value, cap }
  })
}

export function combinedGrowths(unitId: string, classId: number, variableParentId?: string): number[] {
  const row = unitRow(unitId)
  const cls = classRow(classId)
  if (!row || !cls) return [0, 0, 0, 0, 0, 0, 0, 0]
  return personalGrowths(unitId, variableParentId).map((g, i) => g + cls.growths[i])
}

/**
 * Child personal growths shown in the UI are the average of the child's own
 * growths and the variable parent's (docs/DATA.md; verified floor rule).
 */
export function personalGrowths(unitId: string, variableParentId?: string): number[] {
  const row = unitRow(unitId)
  if (!row) return [0, 0, 0, 0, 0, 0, 0, 0]
  if (!row.fixedParent || !variableParentId) return [...row.growths]
  const parent = unitRow(variableParentId)
  if (!parent) return [...row.growths]
  return row.growths.map((g, i) => Math.floor((g + parent.growths[i]) / 2))
}

export function conflictFor(unitId: string): string | undefined {
  return CONFLICTS.find((c) => c.unitIds.includes(unitId))?.message
}

export function partnerName(unitId: string | undefined): string | undefined {
  return unitId ? (unitRow(unitId)?.name ?? unitId) : undefined
}

export interface PartnerClassOffer {
  classId: number
  name: string
  skillName: string
}

/** The base class a unit offers a Partner Seal partner (primary branch). */
export function partnerOffer(unitId: string): PartnerClassOffer | null {
  const row = unitRow(unitId)
  if (!row) return null
  const baseId = row.classes[row.classes.length - 1] ?? row.classes[0]
  const base = classRow(baseId)
  if (!base) return null
  const skillId = base.skills[0] ?? 0
  return { classId: baseId, name: base.name, skillName: skillName(skillId) }
}

export function statKeyIndex(key: StatKey): number {
  return ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res'].indexOf(key)
}

export function skillLearnTag(tier: ClassTier, index: number, classId: number): string {
  return `${className(classId)} · ${learnLevel(tier, index)}`
}

export function viaForStop(stop: FixtureStop): string {
  const base = sealLabel(stop.via)
  if (stop.viaNote) return `${base} · ${stop.viaNote}`
  return base
}
