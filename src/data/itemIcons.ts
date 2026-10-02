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
}

const ITEMS = manifestJson as ItemManifest
// Read here rather than from ./art: skill access (logic) imports this module.
const ASSETS_ENABLED = import.meta.env.VITE_ASSETS !== 'off'
const BASE_URL = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`

/** Skills a skill book teaches (DLC items), by skill id. */
export const SKILL_BOOKS: ReadonlySet<number> = new Set(Object.keys(ITEMS.books).map(Number))

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
