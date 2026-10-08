import { DEFAULT_DLC_IDS, hasDlc, itemGrants } from './dlcs'
import manifestJson from './itemIcons.json'
import type { Dataset } from './types'

/**
 * Reclass items and skill books from the installed build's item table, with Icon Project icons
 * (tools/assets/extract_item_icons.py; provenance per entry in itemIcons.json).
 */
interface ItemManifest {
  generatedAt: string
  /** Seal kind -> item key (master, heart, partner, friendship, eternal, offspring). */
  seals: Record<string, string>
  /** Class id (one gender's) -> its class-change item key (DLC and amiibo classes). */
  classItems: Record<string, string>
  /** Skill id -> its skill book's item key. */
  books: Record<string, string>
  items: Record<string, { file: string; name: string; source: string }>
  /**
   * Copies one save can get when every NA content DLC is on (curated research); superseded at
   * runtime by the per-DLC grants in data/dlcs.ts, kept for shop stock and the unobtainable books.
   */
  limits: Record<string, number>
  /** Limited items the Festival of Bonds DLC maps hand out repeatedly (Hero's / Exalt's Brand). */
  festivalUnlimited: string[]
}

const ITEMS = manifestJson as ItemManifest
// Read here rather than from ./art: skill access (logic) imports this module.
const ASSETS_ENABLED = import.meta.env.VITE_ASSETS !== 'off'
const BASE_URL = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`

interface DlcState {
  dlcs?: string[]
}

/**
 * How many of an item one save can get with this run's DLC; null = unlimited, 0 = nothing in the
 * run hands it out. DLC items add up their enabled maps' copies (a repeatable map wins); shop
 * stock and the books with no released source keep the manifest's limits.
 */
export function itemLimit(key: string, run?: DlcState): number | null {
  const grants = itemGrants(key)
  if (!grants.length) return ITEMS.limits[key] ?? null
  const state = run ?? { dlcs: [...DEFAULT_DLC_IDS] }
  const enabled = grants.filter((grant) => hasDlc(state, grant.dlc.id))
  if (enabled.some((grant) => grant.copies === null)) return null
  return enabled.reduce((total, grant) => total + (grant.copies ?? 0), 0)
}

/** Whether this run can get the item at all (its map is on; repeatable maps always count). */
export function itemAvailable(key: string, run: DlcState): boolean {
  return itemLimit(key, run) !== 0
}

/**
 * Skills a skill book teaches (DLC items), by skill id - only books some content DLC hands out
 * (Armor Shield, Beast Shield, Winged Shield and Bold Stance have item records but no source).
 */
export const SKILL_BOOKS: ReadonlySet<number> = new Set(
  Object.entries(ITEMS.books).filter(([, key]) => itemGrants(key).length > 0).map(([id]) => Number(id)),
)

/** The run's DLC grants this skill book (its map's toggle is on). */
export function bookAvailable(run: DlcState, skillId: number): boolean {
  const key = ITEMS.books[String(skillId)]
  return key ? itemAvailable(key, run) : false
}

/** The run's DLC grants this class-change item, so the class is open to plan into. */
export function classItemAvailable(dataset: Dataset, classId: number, run: DlcState): boolean {
  const key = classItemKey(dataset, classId)
  return key ? itemAvailable(key, run) : true
}

export function itemName(key: string): string {
  return ITEMS.items[key]?.name ?? key
}

export function itemIconUrl(key: string): string | null {
  const entry = ITEMS.items[key]
  if (!ASSETS_ENABLED || !entry) return null
  return `${BASE_URL}${entry.file}?v=${encodeURIComponent(ITEMS.generatedAt)}`
}

export function sealItemKey(seal: string): string | undefined {
  return ITEMS.seals[seal]
}

export function bookItemKey(skillId: number): string | undefined {
  return ITEMS.books[String(skillId)]
}

/** The item that changes a unit into this DLC class, whichever gender's class id the table names. */
export function classItemKey(dataset: Dataset, classId: number): string | undefined {
  const family = (id: number) => dataset.classesById.get(id)?.name.replace(/\s*\((M|F)\)$/, '')
  const target = family(classId)
  const match = Object.entries(ITEMS.classItems).find(([id]) => family(Number(id)) === target)
  return match?.[1]
}
