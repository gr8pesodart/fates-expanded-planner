/**
 * The Dragon's Gate DLC lineup a run can opt into, one entry per purchasable DLC.
 *
 * Sources (NA names; research 2026-10-08, quotes in docs/DATA.md › DLC catalog):
 * - Serenes Forest › Fates › Downloadable Content (NA and Japan tables)
 * - Serenes Forest › Fates › DLC › Maps (per-map rewards, including enemy-held skill scrolls)
 *
 * Only "content" entries - the ones that add something to plan with (a unit, a class or a
 * skill) - get a toggle and gate planning. Boo Camp, Ghostly Gold, Beach Brawl and Museum Melee
 * give experience, gold, illustrations and weapons: nothing the planner models, so they are kept
 * here as documentation only.
 *
 * Item keys are the installed build's item table (data/itemIcons.json): class-change items
 * (`class-<id>`) and skill books (`book-<skillId>`). `null` copies = repeatable reward.
 */

export type DlcGroup = 'pack1' | 'pack2' | 'japan'

export interface DlcEntry {
  id: string
  name: string
  /** One-line effect for the toggle row. */
  effect: string
  /** Adds a unit, class or skill; only content entries get toggles. */
  content: boolean
  group: DlcGroup
  /** Unit ids the DLC recruits (Anna on the Run). */
  units?: string[]
  /** Item key -> copies one save can get (null = repeatable). */
  items?: Record<string, number | null>
}

export const DLC_CATALOG: readonly DlcEntry[] = [
  {
    id: 'before-awakening',
    name: 'Before Awakening',
    effect: "Exalt's Brand + Hero's Brand, one each (Great Lord, Lodestar)",
    content: true,
    group: 'pack1',
    items: { 'class-124': 1, 'class-126': 1 },
  },
  {
    id: 'royal-royale',
    name: 'Royal Royale',
    effect: 'Dread Scroll + Ebon Wing, repeatable (Dread Fighter, Dark Falcon)',
    content: true,
    group: 'pack1',
    items: { 'class-118': null, 'class-120': null },
  },
  {
    id: 'hidden-truths',
    name: 'Hidden Truths 1 & 2',
    effect: 'Fell Brand, repeatable (Grandmaster)',
    content: true,
    group: 'pack1',
    items: { 'class-127': null },
  },
  {
    id: 'vanguard-dawn',
    name: 'Vanguard Dawn',
    effect: 'Vanguard Brand, repeatable (Vanguard); Heavy Blade, Veteran Intuition and Aether skill books',
    content: true,
    group: 'pack1',
    items: { 'class-125': null, 'book-158': null, 'book-159': null, 'book-26': null },
  },
  {
    id: 'anna-on-the-run',
    name: 'Anna on the Run',
    effect: 'Anna joins the army',
    content: true,
    group: 'pack1',
    units: ['PID_アンナ'],
  },
  {
    id: 'ballistician-blitz',
    name: 'Ballistician Blitz',
    effect: 'Sighting Lens, repeatable (Ballistician)',
    content: true,
    group: 'pack1',
    items: { 'class-122': null },
  },
  {
    id: 'annas-gift',
    name: 'A Gift from Anna',
    effect: "One Sighting Lens or Witch's Mark (the planner counts one of each)",
    content: true,
    group: 'pack1',
    items: { 'class-122': 1, 'class-123': 1 },
  },
  {
    id: 'witches-trial',
    name: "Witches' Trial",
    effect: "Witch's Mark, repeatable (Witch); Warp skill book",
    content: true,
    group: 'pack1',
    items: { 'class-123': null, 'book-154': null },
  },
  {
    id: 'another-gift-from-anna',
    name: 'Another Gift From Anna',
    effect: 'Paragon skill book, one',
    content: true,
    group: 'pack2',
    items: { 'book-138': 1 },
  },
  {
    id: 'heirs-1',
    name: 'I: In Endless Dreams',
    effect: 'Skilltaker and Lucktaker skill books',
    content: true,
    group: 'pack2',
    items: { 'book-144': null, 'book-146': null },
  },
  {
    id: 'heirs-2',
    name: 'II: Realms Collide',
    effect: 'Magictaker skill book',
    content: true,
    group: 'pack2',
    items: { 'book-143': null },
  },
  {
    id: 'heirs-3',
    name: 'III: The Changing Tide',
    effect: 'Strengthtaker skill book',
    content: true,
    group: 'pack2',
    items: { 'book-142': null },
  },
  {
    id: 'heirs-4',
    name: "IV: Light's Sacrifice",
    effect: 'Defensetaker skill book',
    content: true,
    group: 'pack2',
    items: { 'book-147': null },
  },
  {
    id: 'heirs-5',
    name: 'V: Endless Dawn',
    effect: 'Speedtaker and Resistancetaker skill books',
    content: true,
    group: 'pack2',
    items: { 'book-145': null, 'book-148': null },
  },
  {
    id: 'lost-in-the-waves',
    name: 'End: Lost in the Waves',
    effect: 'Point Blank skill book',
    content: true,
    group: 'pack2',
    items: { 'book-121': null },
  },
  {
    id: 'hoshidan-festival',
    name: 'Hoshidan Festival of Bonds',
    effect: "Exalt's Brand, repeatable (Great Lord)",
    content: true,
    group: 'japan',
    items: { 'class-126': null },
  },
  {
    id: 'nohrian-festival',
    name: 'Nohrian Festival of Bonds',
    effect: "Hero's Brand, repeatable (Lodestar)",
    content: true,
    group: 'japan',
    items: { 'class-124': null },
  },
  {
    id: 'boo-camp',
    name: 'Boo Camp',
    effect: 'Experience grinding (not modelled)',
    content: false,
    group: 'pack1',
  },
  {
    id: 'beach-brawl',
    name: 'Beach Brawl',
    effect: 'Swimsuit illustrations (not modelled)',
    content: false,
    group: 'pack1',
  },
  {
    id: 'ghostly-gold',
    name: 'Ghostly Gold',
    effect: 'Gold grinding (not modelled)',
    content: false,
    group: 'pack1',
  },
  {
    id: 'museum-melee',
    name: 'Museum Melee',
    effect: 'Weapon drops (not modelled)',
    content: false,
    group: 'pack1',
  },
]

export const CONTENT_DLCS: readonly DlcEntry[] = DLC_CATALOG.filter((dlc) => dlc.content)

/** The Japan-only festival maps; the old "Festival of Bonds DLC" switch turned both on. */
export const FESTIVAL_DLC_IDS: readonly string[] = ['hoshidan-festival', 'nohrian-festival']

/** A new run starts with every NA content DLC (the old `dlc: true`) and no festival maps. */
export const DEFAULT_DLC_IDS: readonly string[] = CONTENT_DLCS.filter((dlc) => dlc.group !== 'japan').map((dlc) => dlc.id)

interface DlcState {
  dlcs?: string[]
}

export function hasDlc(run: DlcState, id: string): boolean {
  return run.dlcs?.includes(id) ?? false
}

/** The DLC that recruits a unit, if any (Anna on the Run). */
export function dlcForUnit(unitId: string): string | undefined {
  for (const dlc of CONTENT_DLCS) if (dlc.units?.includes(unitId)) return dlc.id
  return undefined
}

export function unitDlcOn(run: DlcState, unitId: string): boolean {
  const id = dlcForUnit(unitId)
  return id === undefined ? true : hasDlc(run, id)
}

export interface ItemGrant {
  dlc: DlcEntry
  /** Copies one save gets from this DLC; null = repeatable. */
  copies: number | null
}

/** Every content DLC that hands out this item key, repeatable or not. */
export function itemGrants(key: string): ItemGrant[] {
  const grants: ItemGrant[] = []
  for (const dlc of CONTENT_DLCS) {
    const copies = dlc.items?.[key]
    if (copies !== undefined) grants.push({ dlc, copies })
  }
  return grants
}
