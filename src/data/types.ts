/**
 * Core game-data types for the planner.
 *
 * The planner is dataset-driven: a pack is a JSON bundle keyed by the game's
 * internal person IDs (PIDs). The `ugf-2.5.2` pack is extracted from the
 * installed Unofficial Gay Fates build (see tools/extract + docs/DATA.md),
 * so the support graph matches the modded game exactly.
 */

export type Route = 'birthright' | 'conquest' | 'revelation'

export const ROUTES: ReadonlyArray<{ id: Route; label: string; blurb: string }> = [
  {
    id: 'birthright',
    label: 'Birthright',
    blurb: 'Hoshido — dawn crimson. Birthright-exclusive units and supports apply.',
  },
  {
    id: 'conquest',
    label: 'Conquest',
    blurb: 'Nohr — dusk violet. Conquest-exclusive units and supports apply.',
  },
  {
    id: 'revelation',
    label: 'Revelation',
    blurb: 'Valla — deep teal. Both kingdoms join; Revelation-only supports apply.',
  },
]

export type StatKey = 'hp' | 'str' | 'mag' | 'skl' | 'spd' | 'lck' | 'def' | 'res'

export const STAT_KEYS: readonly StatKey[] = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res']

export const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  str: 'Strength',
  mag: 'Magic',
  skl: 'Skill',
  spd: 'Speed',
  lck: 'Luck',
  def: 'Defense',
  res: 'Resistance',
}

/** One character row from a dataset pack. */
export interface CharacterDef {
  /** Internal person id, e.g. `PID_リョウマ`. Stable key across the dataset. */
  id: string
  /** Display name — falls back to the raw PID suffix until an English map lands. */
  name: string
  /** Raw `Support Route` value from the UGF Paragon export, when present. */
  supportRoute?: number | null
  /** True for `PID_プレイヤー男` / `PID_プレイヤー女` (Corrin). */
  isCorrin?: boolean
}

/** Raw support row: character indices + raw u32 support type. */
export type RawSupportTuple = [number, number, number]

export type SupportKind = 'romantic' | 'platonic'

/**
 * Decoded support type. The raw u32 packs four point thresholds, high byte
 * first: `S<<24 | A<<16 | B<<8 | C`. `0xFF` in a byte means that rank is
 * unreachable. Examples:
 *   0x140E0904 romantic (S needs 20 points), 0x120C0703 fast romantic,
 *   0xFF0E0904 platonic (no S).
 */
export interface SupportInfo {
  kind: SupportKind
  /** Faster-than-normal support growth (lower point thresholds). */
  fast: boolean
  /** Point threshold per rank, or null when that rank is unreachable. */
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
  /** Character id -> edges touching it. */
  edgesByCharacter: Map<string, DatasetEdge[]>
}

export function findsupportsFor(dataset: Dataset, characterId: string): DatasetEdge[] {
  return dataset.edgesByCharacter.get(characterId) ?? []
}

export function datasetStats(dataset: Dataset) {
  const romantic = dataset.edges.filter((e) => e.info.kind === 'romantic').length
  return {
    characters: dataset.characters.length,
    edges: dataset.edges.length,
    romantic,
    platonic: dataset.edges.length - romantic,
  }
}
