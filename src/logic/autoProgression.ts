import type { ClassDef, Dataset } from '../data/types'
import type { Reclass, RunPlan } from '../state/model'
import type { UnitContext } from './army'
import { classOnRoute, personalSkill, skillsChildrenInherit } from './army'
import { sexedClassId } from './classes'
import { SKILL_BOOKS } from '../data/itemIcons'
import type { ReclassOption } from './progression'
import { buildProgression, dlcClassesFor, offspringOptions, reclassOptions, skillCandidates, tierCap } from './progression'

/**
 * Children recruited from Chapter 19 carry an Offspring Seal: a free promotion on the join row.
 * `require` plans must use it, `forbid` plans may not; `allow` lets the search pick.
 */
export type OffspringMode = 'allow' | 'require' | 'forbid'

/**
 * "Automate progression" (owner, v3.4): the reclass plan that learns every target skill - the unit's
 * equipped skills, plus (for a parent) the skills its children plan to inherit from it - and ends at
 * the level cap in the unit's selected class. Among those, in order of importance:
 *   1. the fewest seals (every reclass is one item; Eternal Seals are offered separately),
 *   2. the most level-ups in classes wielding the weapon of an equipped -faire skill,
 *   3. the most class growth in Str / Mag / Spd / Def / Res over the level-ups.
 *
 * Search: level by level over states (class, level, may still reclass on this row, skills known),
 * mirroring buildProgression - a level-up teaches the lowest pending threshold of the class held, one
 * skill per level-up; reclassing teaches nothing. Each state keeps its best path (lexicographic cost),
 * and only classes that teach a target, or lead into one that does, are entered.
 */

export interface AutoPlan {
  reclasses: Reclass[]
  eternalSeals: number
  /** Seals per kind; DLC class items as `dlc:<classId>`. */
  seals: Record<string, number>
  sealCount: number
  faireLevels: number
  growthScore: number
}

export interface AutoResult {
  /** Skills the plan learns. */
  targets: number[]
  /** Target skills nothing within reach teaches. */
  unreachable: number[]
  /** Target skills learned from their skill book (DLC on): no class teaches them, or the player chose the book. */
  books: number[]
  /** Unit's own picks it inherits from a parent instead (not planned here). */
  inherited: number[]
  plan: AutoPlan | null
  /** A plan with Eternal Seals that needs fewer other seals than `plan` - or the only plan, if `plan` is null. */
  withEternal: AutoPlan | null
}

// Faire skill -> weapon rank column (sword, lance, axe, dagger, bow, tome, staff, stone).
const FAIRE_WEAPON: Record<string, number> = { Swordfaire: 0, Lancefaire: 1, Axefaire: 2, Shurikenfaire: 3, Bowfaire: 4, Tomefaire: 5 }
// Class growth columns (HP, Str, Mag, Skl, Spd, Lck, Def, Res): Str, Mag, Spd, Def, Res.
const GROWTH_STATS = [1, 2, 4, 6, 7]
const MAX_SEALS = 10
const MAX_ETERNAL = 3

interface Cost {
  seals: number
  faire: number
  growth: number
}

const better = (a: Cost, b: Cost) => a.seals !== b.seals ? a.seals < b.seals : a.faire !== b.faire ? a.faire > b.faire : a.growth > b.growth

interface Node {
  classId: number
  level: number
  /** This row's reclass event is still unused. */
  canReclass: boolean
  /** Skills known, one bit per skill the useful classes teach. */
  known: bigint
  segment: number
  cost: Cost
  sealsUsed: Record<string, number>
  parent: Node | null
  event: Reclass | null
}

/** The skills the plan must learn, and the ones it can't plan for. */
export function autoTargets(dataset: Dataset, run: RunPlan, ctx: UnitContext): { wanted: number[]; inherited: number[] } {
  const personal = personalSkill(ctx.unit, run)
  const own = [ctx.plan.inheritFixedSkill, ctx.plan.inheritSkill].filter((id): id is number => id !== undefined)
  const equipped = ctx.plan.skills.filter((id): id is number => id !== null)
  const forChildren = [...skillsChildrenInherit(dataset, run, ctx.unit.id).keys()]
  const all = [...new Set([...equipped, ...forChildren])].filter((id) => id !== personal)
  return { wanted: all.filter((id) => !own.includes(id)), inherited: all.filter((id) => own.includes(id)) }
}

/**
 * Target skills a skill book could teach instead of a class - the ones to ask about (owner, v3.4). Not
 * asked when another target without a book comes from a class that teaches this one too: that class
 * is on the path anyway (Speedtaker with Dual Guardsman: learn both in Lodestar).
 */
export function bookOrClassChoices(dataset: Dataset, run: RunPlan, ctx: UnitContext): number[] {
  if (!run.dlc) return []
  const { wanted } = autoTargets(dataset, run, ctx)
  const teachers = new Map(reachableClasses(dataset, run, ctx).map((def) => [def.id, skillCandidates(dataset, ctx, def).map((item) => item.skillId)]))
  const taughtBy = (skillId: number) => [...teachers.entries()].filter(([, skills]) => skills.includes(skillId)).map(([id]) => id)
  return wanted.filter((skillId) => SKILL_BOOKS.has(skillId) && taughtBy(skillId).length > 0 && !wanted.some((other) => (
    other !== skillId && !SKILL_BOOKS.has(other) && taughtBy(other).some((classId) => taughtBy(skillId).includes(classId))
  )))
}

/**
 * Equipped skills the planned path doesn't teach but a skill book does (DLC on): the Progression page
 * assumes the book (owner, v3.4) and counts it with the seals.
 */
export function skillBooksUsed(run: RunPlan, ctx: UnitContext, learned: ReadonlySet<number>): number[] {
  if (!run.dlc) return []
  const own = [ctx.plan.inheritFixedSkill, ctx.plan.inheritSkill]
  const personal = personalSkill(ctx.unit, run)
  return [...new Set(ctx.plan.skills)].filter((id): id is number => id !== null && id !== personal && !own.includes(id) && !learned.has(id) && SKILL_BOOKS.has(id))
}

/** `bookSkills`: skills the player chose to learn from their skill book rather than a class. */
export function autoProgression(dataset: Dataset, run: RunPlan, ctx: UnitContext, bookSkills: readonly number[] = [], offspring: OffspringMode = 'allow'): AutoResult {
  const { wanted, inherited } = autoTargets(dataset, run, ctx)
  const classes = reachableClasses(dataset, run, ctx)
  const learnable = new Set(classes.flatMap((def) => skillCandidates(dataset, ctx, def).map((item) => item.skillId)))
  const byBook = (id: number) => run.dlc && SKILL_BOOKS.has(id) && (!learnable.has(id) || bookSkills.includes(id))
  const targets = wanted.filter((id) => learnable.has(id) && !byBook(id))
  const books = wanted.filter(byBook)
  const unreachable = wanted.filter((id) => !learnable.has(id) && !byBook(id))
  // More Eternal Seals never need more seals (the extra levels can only teach more), so the most
  // Eternal Seals give the floor; the plan without starts its seal budget there, and fewer Eternal
  // Seals are only tried at that floor (the fewest that reach it are offered).
  const goalTier = dataset.classesById.get(ctx.currentClassId)?.tier
  const floor = goalTier === 'base' ? null : cheapest(dataset, run, ctx, targets, classes, MAX_ETERNAL, MAX_SEALS, 0, offspring)
  const plan = cheapest(dataset, run, ctx, targets, classes, 0, MAX_SEALS, floor?.sealCount ?? 0, offspring)
  let withEternal: AutoPlan | null = null
  if (floor && (!plan || floor.sealCount < plan.sealCount)) {
    withEternal = floor
    for (let eternal = 1; eternal < MAX_ETERNAL; eternal += 1) {
      const fewer = solve(dataset, run, ctx, targets, classes, eternal, floor.sealCount, offspring)
      if (fewer) {
        withEternal = fewer
        break
      }
    }
  }
  return { targets, unreachable, books, inherited, plan, withEternal }
}

/** Every class the unit could ever hold: join class, pool, their promotions on route, DLC classes. */
function reachableClasses(dataset: Dataset, run: RunPlan, ctx: UnitContext): ClassDef[] {
  const ids = new Set<number>([ctx.start.classId, ...ctx.pool.map((entry) => entry.classId)])
  for (const id of [...ids]) {
    for (const promo of dataset.classesById.get(id)?.promotesTo ?? []) {
      const sexed = sexedClassId(dataset, promo, ctx.unit.gender)
      if (classOnRoute(dataset, sexed, run.route)) ids.add(sexed)
    }
  }
  if (run.dlc) for (const def of dlcClassesFor(dataset, ctx.unit.gender)) ids.add(def.id)
  return [...ids].flatMap((id) => {
    const def = dataset.classesById.get(id)
    return def && (!def.dlc || run.dlc) ? [def] : []
  })
}

/**
 * Seals come first, so search with a growing seal budget and stop at the first that works: the
 * budget prunes every longer reclass chain, which is most of the state space.
 */
function cheapest(dataset: Dataset, run: RunPlan, ctx: UnitContext, targets: number[], classes: ClassDef[], eternal: number, maxSeals: number, from = 0, offspring: OffspringMode = 'allow'): AutoPlan | null {
  for (let budget = from; budget <= maxSeals; budget += 1) {
    const plan = solve(dataset, run, ctx, targets, classes, eternal, budget, offspring)
    if (plan) return plan
  }
  return null
}

function solve(dataset: Dataset, run: RunPlan, ctx: UnitContext, targets: number[], classes: ClassDef[], eternal: number, budget: number, offspring: OffspringMode = 'allow'): AutoPlan | null {
  const goal = ctx.currentClassId
  const byId = new Map(classes.map((def) => [def.id, def]))
  if (!byId.has(goal)) return null
  const startOffspring = offspring === 'forbid' ? [] : offspringOptions(dataset, run, ctx).filter((option) => byId.has(option.classId))
  if (offspring === 'require' && !startOffspring.length) return null

  const candidates = new Map(classes.map((def) => [def.id, skillCandidates(dataset, ctx, def)]))
  const effective = (def: ClassDef, level: number) => (def.tier === 'promoted' ? 20 + level : level)
  // Classes worth entering: teach a target, are the goal, or promote into one of those.
  const useful = new Set<number>([goal, ctx.start.classId])
  for (const def of classes) if (candidates.get(def.id)!.some((item) => targets.includes(item.skillId))) useful.add(def.id)
  for (const def of classes) {
    if (def.tier !== 'base') continue
    if (def.promotesTo.some((promo) => useful.has(sexedClassId(dataset, promo, ctx.unit.gender)))) useful.add(def.id)
  }
  // Skills known, as a bitmask over the skills the useful classes teach (only those can be learned).
  const bit = new Map<number, bigint>()
  for (const id of useful) for (const item of candidates.get(id) ?? []) if (!bit.has(item.skillId)) bit.set(item.skillId, 1n << BigInt(bit.size))
  const goalMask = targets.reduce((mask, id) => mask | (bit.get(id) ?? 0n), 0n)

  // Lower bound on the seals still needed: every class other than the one held costs at least one
  // seal to enter, and the targets still missing need at least `cover[missing]` such classes (exact
  // minimum set cover over the targets, which number a handful). States that can't finish within
  // the budget are cut.
  const targetBits = targets.map((id) => bit.get(id)!)
  const teaches = new Map([...useful].map((id) => [id, targetBits.reduce((mask, skillBit, index) => (
    (candidates.get(id) ?? []).some((item) => bit.get(item.skillId) === skillBit) ? mask | (1 << index) : mask
  ), 0)]))
  const teachMasks = [...new Set(teaches.values())].filter(Boolean)
  const cover = new Map<number, number>([[0, 0]])
  const coverOf = (mask: number): number => {
    const known = cover.get(mask)
    if (known !== undefined) return known
    let least = Infinity
    for (const teach of teachMasks) if (teach & mask) least = Math.min(least, 1 + coverOf(mask & ~teach))
    cover.set(mask, least)
    return least
  }
  // Levels on one scale: base Lv, advanced 20 + Lv, special Lv. Reclassing never moves it back
  // (promotion jumps it forward), each level-up adds one, and the path ends at the goal's cap - so a
  // state can learn at most `goalEnd - scale` more skills, one per level-up.
  const scale = (def: ClassDef, level: number) => (def.tier === 'promoted' ? 20 + level : level)
  const goalDef = byId.get(goal)!
  const goalEnd = scale(goalDef, tierCap(goalDef.tier, eternal, ctx.unit.levelCap))
  const lowerBound = (node: Pick<Node, 'classId' | 'known' | 'level' | 'parent'>) => {
    let missing = 0
    let count = 0
    targetBits.forEach((skillBit, index) => {
      if (!(node.known & skillBit)) {
        missing |= 1 << index
        count += 1
      }
    })
    if (count > goalEnd - scale(byId.get(node.classId)!, node.level)) return Infinity
    const bound = Math.max(coverOf(missing & ~(teaches.get(node.classId) ?? 0)), node.classId === goal ? 0 : 1)
    // From the join row the Offspring Seal enters one class for free.
    return node.parent === null && startOffspring.length ? Math.max(0, bound - 1) : bound
  }
  // Per class: candidates in learning order with their bits.
  const learnOrder = new Map([...useful].map((id) => [id, (candidates.get(id) ?? []).map((item) => ({ ...item, bit: bit.get(item.skillId)! }))]))

  const faireWeapons = ctx.plan.skills.flatMap((id) => {
    const name = id === null ? undefined : dataset.skillsById.get(id)?.name
    return name && name in FAIRE_WEAPON ? [FAIRE_WEAPON[name]] : []
  })
  const levelValue = new Map([...useful].map((id) => {
    const def = byId.get(id)!
    return [id, {
      faire: faireWeapons.some((column) => (def.weaponRanks[column] ?? 0) > 0) ? 1 : 0,
      growth: GROWTH_STATS.reduce((sum, index) => sum + (def.growths[index] ?? 0), 0),
    }]
  }))
  const cap = (def: ClassDef) => tierCap(def.tier, eternal, ctx.unit.levelCap)
  const optionCache = new Map<string, ReclassOption[]>()
  const options = (classId: number, level: number) => {
    const key = `${classId}:${level}`
    let list = optionCache.get(key)
    if (!list) {
      list = reclassOptions(dataset, run, ctx, classId, level).filter((option) => useful.has(option.classId) && byId.has(option.classId))
      optionCache.set(key, list)
    }
    return list
  }

  const startDef = byId.get(ctx.start.classId)
  if (!startDef) return null
  const startKnown = learnOrder.get(startDef.id)!
    .filter((item) => item.threshold <= effective(startDef, ctx.start.level))
    .reduce((mask, item) => mask | item.bit, 0n)

  // States sharing (class, level, row event unused) are compared by Pareto dominance: knowing a
  // superset of skills at a no-worse cost can do everything the other can (a level-up then learns
  // the same skill or one the other still lacks), and the lexicographic cost order survives adding
  // the same future costs to both.
  type Bucket = Node[]
  const bucketKey = (node: Pick<Node, 'classId' | 'level' | 'canReclass'>) => `${node.classId}|${node.level}|${node.canReclass ? 1 : 0}`
  const notWorse = (a: Cost, b: Cost) => !better(b, a)
  const offer = (map: Map<string, Bucket>, node: Node): boolean => {
    if (node.cost.seals + lowerBound(node) > budget) return false
    const key = bucketKey(node)
    const bucket = map.get(key)
    if (!bucket) {
      map.set(key, [node])
      return true
    }
    for (const other of bucket) if ((other.known & node.known) === node.known && notWorse(other.cost, node.cost)) return false
    const kept = bucket.filter((other) => !((node.known & other.known) === other.known && notWorse(node.cost, other.cost)))
    kept.push(node)
    map.set(key, kept)
    return true
  }

  let layer = new Map<string, Bucket>()
  offer(layer, { classId: startDef.id, level: ctx.start.level, canReclass: true, known: startKnown, segment: 0, cost: { seals: 0, faire: 0, growth: 0 }, sealsUsed: {}, parent: null, event: null })
  let best: Node | null = null
  const alive = (map: Map<string, Bucket>, node: Node) => map.get(bucketKey(node))?.includes(node) ?? false

  for (let step = 0; step < 200 && layer.size; step += 1) {
    // Reclasses on this row (a new segment's first row may reclass again).
    const queue = [...layer.values()].flat().filter((node) => node.canReclass)
    while (queue.length) {
      const node = queue.pop()!
      if ((node.cost.seals >= budget && !(node.parent === null && startOffspring.length)) || !alive(layer, node)) continue
      const atJoin = node.parent === null
      const rowOptions = atJoin ? (offspring === 'require' ? startOffspring : [...startOffspring, ...options(node.classId, node.level)]) : options(node.classId, node.level)
      for (const option of rowOptions) {
        const seal = option.seal === 'dlc' ? `dlc:${option.classId}` : option.seal
        // The Offspring Seal comes with the child: it's tallied, but costs no seal.
        const cost = option.seal === 'offspring' ? 0 : 1
        const next: Node = {
          classId: option.classId,
          level: option.newSegment ? option.level : node.level,
          canReclass: option.newSegment,
          known: node.known,
          segment: node.segment + (option.newSegment ? 1 : 0),
          cost: { ...node.cost, seals: node.cost.seals + cost },
          sealsUsed: { ...node.sealsUsed, [seal]: (node.sealsUsed[seal] ?? 0) + 1 },
          parent: node,
          event: { segment: node.segment, level: node.level, classId: option.classId, ...(option.seal === 'offspring' ? { seal: 'offspring' as const } : {}) },
        }
        if (offer(layer, next) && next.canReclass) queue.push(next)
      }
    }
    // Ends: the cap of the tier held, in the selected class, with every target learned.
    const goalDef = byId.get(goal)!
    for (const node of layer.get(bucketKey({ classId: goal, level: cap(goalDef), canReclass: true })) ?? []) {
      if ((node.known & goalMask) === goalMask && (!best || better(node.cost, best.cost))) best = node
    }
    for (const node of layer.get(bucketKey({ classId: goal, level: cap(goalDef), canReclass: false })) ?? []) {
      if ((node.known & goalMask) === goalMask && (!best || better(node.cost, best.cost))) best = node
    }
    // Level-ups. A required Offspring Seal is taken before anything else.
    const next = new Map<string, Bucket>()
    for (const node of [...layer.values()].flat()) {
      if (offspring === 'require' && node.parent === null) continue
      const def = byId.get(node.classId)!
      if (node.level >= cap(def)) continue
      const level = node.level + 1
      const learned = learnOrder.get(def.id)!.find((item) => item.threshold <= effective(def, level) && !(node.known & item.bit))
      const value = levelValue.get(def.id)!
      offer(next, {
        ...node,
        level,
        canReclass: true,
        known: learned ? node.known | learned.bit : node.known,
        cost: { seals: node.cost.seals, faire: node.cost.faire + value.faire, growth: node.cost.growth + value.growth },
        parent: node,
        event: null,
      })
    }
    layer = next
  }
  if (!best) return null

  const reclasses: Reclass[] = []
  for (let node: Node | null = best; node; node = node.parent) if (node.event) reclasses.unshift(node.event)
  const sealCount = Object.entries(best.sealsUsed).reduce((sum, [kind, count]) => sum + (kind === 'offspring' ? 0 : count), 0)
  return { reclasses, eternalSeals: eternal, seals: best.sealsUsed, sealCount, faireLevels: best.cost.faire, growthScore: best.cost.growth }
}

/** Whether a plan, applied to the run, really learns every target and ends in the selected class. */
export function verifyAutoPlan(dataset: Dataset, run: RunPlan, ctx: UnitContext, targets: number[], plan: AutoPlan): boolean {
  const unitPlan = { ...ctx.plan, reclasses: plan.reclasses, eternalSeals: plan.eternalSeals || undefined }
  const nextRun: RunPlan = { ...run, units: { ...run.units, [ctx.unit.id]: unitPlan } }
  const progression = buildProgression(dataset, nextRun, { ...ctx, plan: unitPlan })
  const learned = new Set([...progression.startsWith, ...progression.segments.flatMap((segment) => segment.rows.flatMap((row) => row.learned))].map((item) => item.skillId))
  const last = progression.segments.at(-1)?.rows.at(-1)
  const finalClass = last ? last.reclass ?? last.classId : null
  return progression.dropped.length === 0 && finalClass === ctx.currentClassId && targets.every((id) => learned.has(id))
}

