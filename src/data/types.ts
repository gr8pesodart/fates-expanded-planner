/**
 * Core game-data types for the planner.
 *
 * Everything is dataset-driven from the extracted UGF build pack:
 *  - characters.json / supports.json: the mod's support graph
 *  - units.json / classes.json / skills.json: stats, growths, class sets
 *    and class skills read from the game's own GameData table (docs/DATA.md)
 */

export type Route = 'birthright' | 'conquest' | 'revelation'

export const ROUTES: ReadonlyArray<{ id: Route; label: string; blurb: string }> = [
  { id: 'birthright', label: 'Birthright', blurb: 'Hoshido — dawn crimson.' },
  { id: 'conquest', label: 'Conquest', blurb: 'Nohr — dusk violet.' },
  { id: 'revelation', label: 'Revelation', blurb: 'Valla — deep teal.' },
]

export type StatKey = 'hp' | 'str' | 'mag' | 'skl' | 'spd' | 'lck' | 'def' | 'res'

export const STAT_KEYS: readonly StatKey[] = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res']

export type StatTableKey = StatKey | 'mov'
export const STAT_TABLE_KEYS: readonly StatTableKey[] = [...STAT_KEYS, 'mov']

export const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  str: 'Str',
  mag: 'Mag',
  skl: 'Skl',
  spd: 'Spd',
  lck: 'Lck',
  def: 'Def',
  res: 'Res',
}

export const STAT_LABELS_LONG: Record<StatKey, string> = {
  hp: 'HP',
  str: 'Strength',
  mag: 'Magic',
  skl: 'Skill',
  spd: 'Speed',
  lck: 'Luck',
  def: 'Defense',
  res: 'Resistance',
}

export const STAT_TABLE_LABELS: Record<StatTableKey, string> = { ...STAT_LABELS, mov: 'Mov' }

/** One character row from a dataset pack. */
export interface CharacterDef {
  id: string
  name: string
  supportRoute?: number | null
  isCorrin?: boolean
}

export type RawSupportTuple = [number, number, number]

export type SupportKind = 'romantic' | 'platonic'

/** Decoded support type (see docs/DATA.md for the byte layout). */
export interface SupportInfo {
  kind: SupportKind
  fast: boolean
  ranks: { c: number | null; b: number | null; a: number | null; s: number | null }
}

const RANK_LOCKED = 0xff

export function decodeSupportType(raw: number): SupportInfo {
  const u = raw >>> 0
  const c = u & 0xff
  const b = (u >>> 8) & 0xff
  const a = (u >>> 16) & 0xff
  const s = (u >>> 24) & 0xff
  const pick = (v: number) => (v === RANK_LOCKED ? null : v)
  const canS = s !== RANK_LOCKED
  return {
    kind: canS ? 'romantic' : 'platonic',
    fast: c < 4 && c !== RANK_LOCKED,
    ranks: { c: pick(c), b: pick(b), a: pick(a), s: pick(s) },
  }
}

export interface DatasetEdge {
  a: string
  b: string
  raw: number
  info: SupportInfo
}

// ------------------------------- units -------------------------------------

export interface UnitDef {
  id: string
  name: string
  /** Face id (FID_...) used to look up portraits; null for the avatar. */
  fid: string | null
  slot: number
  gender: 'male' | 'female'
  supportRoute: number
  /** Routes the unit can be recruited in (decoded from the support-route byte). */
  routes: Route[]
  /** DLC-only unit (currently Anna) — hidden when the run has DLC off. */
  dlc: boolean
  levelCap: number | null
  baseStats: number[]
  growths: number[]
  capMods: number[]
  /** Primary class pair (base + promoted, order as stored). */
  classes: number[]
  /** Secondary base classes (reclass options). */
  reclasses: number[]
  weaponRanks: number[]
  personalSkills: { birthright: number | null; conquest: number | null; revelation: number | null }
  /** C/B/A/S rows of pair-up support bonuses (8 stats each, cumulative). */
  supportBonuses: number[][]
  /** no/C/B/A/S rows of attack-stance bonuses (hit/crit/avoid/dodge). */
  attackBonuses: number[][]
  /** PID of the fixed parent for second-gen units. */
  fixedParent: string | null
  isCorrin: boolean
}

// ------------------------------ classes ------------------------------------

export type ClassTier = 'base' | 'promoted' | 'special'

export interface ClassSkillLearn {
  id: number
  level: number
}

export interface ClassDef {
  id: number
  /** English name including a " (M)"/" (F)" suffix for gendered classes. */
  name: string
  ja: string
  /** Job id (JID_...) naming the sprite folder under unit/Body. */
  jid: string
  tier: ClassTier
  /** DLC class (Dread Fighter, Dark Falcon, Ballistician, Witch, Lodestar, Vanguard, Great Lord, Grandmaster). */
  dlc: boolean
  baseStats: number[]
  growths: number[]
  caps: number[]
  /** Pair-up stat bonuses granted when this class is the support unit. */
  pairUp: number[]
  weaponRanks: number[]
  /** Skills learned in this class, in learning order. */
  skills: number[]
  /** Skills with the level they are learned at in this class. */
  skillLearn: ClassSkillLearn[]
  promotesTo: number[]
  promotesFrom: number[]
  movement: number
}

export interface SkillDef {
  id: number
  name: string
  /** In-game description from the English message archive (null when absent). */
  description: string | null
  /** Index into the skill icon sheets (see src/data/assets.json). */
  icon: number
  /** Available only through DLC classes or DLC units. */
  dlc: boolean
}

// ---------------------------- recruitment ----------------------------------

/** One unit's join point on a route (src/data/packs/<id>/recruitment.json, curated with sources). */
export interface RecruitmentEntry {
  unit: string
  /** Position in the route's recruitment order; optional recruits sit at their chapter. */
  order: number
  chapter: string
  joinLevel: number
  joinClassId: number
  optional: boolean
  /** Jakob/Felicia: the retainer of Corrin's own gender joins after Chapter 15 instead. */
  ifCorrin?: Partial<Record<'male' | 'female', { order: number; chapter: string; joinLevel: number }>>
}

// ------------------------------ dataset ------------------------------------

export interface DatasetMeta {
  id: string
  label: string
  status: 'extracted' | 'pending'
  generatedAt?: string
  source?: { file: string; sha256: string; tool: string }
  counts?: { characters: number; edges: number }
  notes?: string[]
}

export interface Dataset {
  meta: DatasetMeta
  characters: CharacterDef[]
  edges: DatasetEdge[]
  edgesByCharacter: Map<string, DatasetEdge[]>
  units: UnitDef[]
  unitsById: Map<string, UnitDef>
  classes: ClassDef[]
  classesById: Map<number, ClassDef>
  skillsById: Map<number, SkillDef>
  /** Per-route join data keyed by unit id; null until the pack ships recruitment.json. */
  recruitment: Record<Route, Map<string, RecruitmentEntry>> | null
}

// ------------------------------ helpers ------------------------------------

export function findCharacter(dataset: Dataset, id: string): CharacterDef | undefined {
  return dataset.characters.find((c) => c.id === id)
}

export function findUnit(dataset: Dataset, id: string): UnitDef | undefined {
  return dataset.unitsById.get(id)
}

export function findClass(dataset: Dataset, id: number): ClassDef | undefined {
  return dataset.classesById.get(id)
}

export function skillName(dataset: Dataset, id: number): string {
  return dataset.skillsById.get(id)?.name ?? `Skill ${id}`
}

export function className(dataset: Dataset, id: number): string {
  return dataset.classesById.get(id)?.name ?? `Class ${id}`
}

export function unitName(dataset: Dataset | null, id: string): string {
  return (
    dataset?.unitsById.get(id)?.name ??
    dataset?.characters.find((c) => c.id === id)?.name ??
    id.replace(/^PID_/, '')
  )
}

export function edgePartner(edge: DatasetEdge, id: string): string {
  return edge.a === id ? edge.b : edge.a
}

/** Support partners of `id` filtered by what the edge allows. */
export function supportPartners(
  dataset: Dataset,
  id: string,
  kind: 'romantic' | 'platonic' | 'a-rank' | 'all',
): DatasetEdge[] {
  const edges = dataset.edgesByCharacter.get(id) ?? []
  if (kind === 'all') return edges
  if (kind === 'romantic') return edges.filter((e) => e.info.kind === 'romantic')
  if (kind === 'platonic') return edges.filter((e) => e.info.kind === 'platonic')
  return edges.filter((e) => e.info.ranks.a !== null)
}

export function datasetStats(dataset: Dataset) {
  const romantic = dataset.edges.filter((e) => e.info.kind === 'romantic').length
  return {
    characters: dataset.characters.length,
    edges: dataset.edges.length,
    romantic,
    platonic: dataset.edges.length - romantic,
    units: dataset.units.length,
    classes: dataset.classes.length,
    skills: dataset.skillsById.size,
  }
}
