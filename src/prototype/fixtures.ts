/**
 * Prototype fixtures: one believable run, using real unit/class/skill ids and
 * real numbers from the installed pack (src/prototype/gameTables.ts) plus the
 * sample decisions from docs/design/reference.html. Screens never import this
 * file — view-model hooks in src/viewmodels/ are the seam.
 */
import type { ClassTier, Route, StatKey } from '../data/types'
import { ROUTES } from '../data/types'

export { PROTO_CLASSES, PROTO_SKILLS, PROTO_SUPPORTS, PROTO_UNITS } from './gameTables'
export type { ProtoClassRow, ProtoSupportRow, ProtoUnitRow } from './gameTables'

// ── ids used across fixtures (match the pack) ──────────────────────────────
export const RYOMA = 'PID_リョウマ'
export const CAMILLA = 'PID_カミラ'
export const SHIRO = 'PID_シノノメ'
export const KIRAGI = 'PID_キサラギ'
export const KAZE = 'PID_スズカゼ'
export const SAIZO = 'PID_サイゾウ'
export const CORRIN = 'PID_プレイヤー男'
export const AZURA = 'PID_アクア'
export const XANDER = 'PID_マークス'
export const TAKUMI = 'PID_タクミ'
export const HINOKA = 'PID_ヒノカ'
export const OBORO = 'PID_オボロ'
export const NILES = 'PID_ゼロ'
export const SELENA = 'PID_ルーナ'
export const SUBAKI = 'PID_ツバキ'
export const SETSUNA = 'PID_セツナ'
export const KANA = 'PID_カンナ女'
export const ANNA = 'PID_アンナ'
export const KAGERO = 'PID_カゲロウ'
export const HINATA = 'PID_ヒナタ'
export const BERUKA = 'PID_ベルカ'
export const CHARLOTTE = 'PID_シャーロッテ'

// ── setup ──────────────────────────────────────────────────────────────────
export interface FixtureModpack {
  id: string
  label: string
  blurb: string
  installed: boolean
  supportNote: string
}

export const MODPACKS: FixtureModpack[] = [
  {
    id: 'ugf-2.5.2',
    label: 'Unofficial Gay Fates 2.5.2',
    blurb: 'The installed build. Same-sex S supports, platonic A+, fast supports.',
    installed: true,
    supportNote: '2463 edges · 71 characters',
  },
  {
    id: 'vanilla',
    label: 'Vanilla Fates',
    blurb: 'Retail support graph. No same-sex S ranks; children follow vanilla parents.',
    installed: false,
    supportNote: 'extraction pending',
  },
]

export interface FixtureRun {
  id: string
  name: string
  modpackId: string
  dlc: boolean
  route: Route
  updatedAt: string
  unitCount: number
  pairCount: number
}

export const RUNS: FixtureRun[] = [
  {
    id: 'run-rainbow',
    name: 'Rainbow run',
    modpackId: 'ugf-2.5.2',
    dlc: true,
    route: 'revelation',
    updatedAt: '2 h ago',
    unitCount: 22,
    pairCount: 3,
  },
  {
    id: 'run-nohr',
    name: 'Nohr classics',
    modpackId: 'ugf-2.5.2',
    dlc: false,
    route: 'conquest',
    updatedAt: '3 d ago',
    unitCount: 14,
    pairCount: 1,
  },
  {
    id: 'run-test',
    name: 'Quick test',
    modpackId: 'vanilla',
    dlc: false,
    route: 'birthright',
    updatedAt: '1 w ago',
    unitCount: 6,
    pairCount: 0,
  },
]

export const ROUTE_OPTIONS = ROUTES

// ── roster ─────────────────────────────────────────────────────────────────
export const ROSTER_IDS: string[] = [
  CORRIN,
  RYOMA,
  CAMILLA,
  SHIRO,
  KIRAGI,
  KAZE,
  SAIZO,
  AZURA,
  XANDER,
  TAKUMI,
  HINOKA,
  OBORO,
  NILES,
  SELENA,
  SUBAKI,
  SETSUNA,
  KANA,
  ANNA,
  KAGERO,
  HINATA,
  BERUKA,
  CHARLOTTE,
]

export const TONES: Record<string, 'hoshido' | 'nohr'> = {
  [RYOMA]: 'hoshido',
  [TAKUMI]: 'hoshido',
  [HINOKA]: 'hoshido',
  [OBORO]: 'hoshido',
  [KAZE]: 'hoshido',
  [SAIZO]: 'hoshido',
  [SUBAKI]: 'hoshido',
  [SETSUNA]: 'hoshido',
  [KIRAGI]: 'hoshido',
  [KAGERO]: 'hoshido',
  [HINATA]: 'hoshido',
  [CAMILLA]: 'nohr',
  [XANDER]: 'nohr',
  [NILES]: 'nohr',
  [SELENA]: 'nohr',
  [BERUKA]: 'nohr',
  [CHARLOTTE]: 'nohr',
}

// ── class pools ────────────────────────────────────────────────────────────
export type ClassSourceId = 'own' | 'secondary' | 'parent' | 'partner' | 'friendship' | 'talent' | 'dlc'

export interface FixtureClassGroup {
  source: ClassSourceId
  label: string
  classIds: number[]
  note?: string
}

export const CLASS_SOURCE_LABELS: Record<ClassSourceId, string> = {
  own: 'Own classes',
  secondary: 'Secondary classes',
  parent: 'From a parent',
  partner: 'Partner Seal',
  friendship: 'Friendship Seal',
  talent: 'Corrin talent',
  dlc: 'DLC classes',
}

const DLC_POOL = [118, 120, 124, 125, 127]
const DLC_POOL_F = [119, 121, 123, 126, 127]

export const CLASS_POOLS: Record<string, FixtureClassGroup[]> = {
  [RYOMA]: [
    { source: 'own', label: 'Own · Samurai', classIds: [33, 31, 35] },
    { source: 'secondary', label: 'Own · Sky Knight', classIds: [59, 57, 61] },
    { source: 'partner', label: 'Partner Seal · Camilla', classIds: [69, 67, 71] },
    { source: 'friendship', label: 'Friendship Seal · Xander', classIds: [9, 7, 11] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL },
  ],
  [CAMILLA]: [
    { source: 'own', label: 'Own · Wyvern Rider', classIds: [70, 68, 72] },
    { source: 'secondary', label: 'Own · Dark Mage', classIds: [86, 84, 88] },
    { source: 'partner', label: 'Partner Seal · Ryoma', classIds: [34, 32, 36] },
    { source: 'friendship', label: 'Friendship Seal · Selena', classIds: [24, 22, 26] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL_F },
  ],
  [SHIRO]: [
    { source: 'own', label: 'Own · Spear Fighter', classIds: [45, 43, 47] },
    { source: 'parent', label: 'Parent · Ryoma', classIds: [33, 31, 35] },
    { source: 'parent', label: 'Parent · Camilla', classIds: [69, 67, 71] },
    { source: 'partner', label: 'Partner Seal · Selena', classIds: [23, 21, 25] },
    { source: 'friendship', label: 'Friendship Seal · Kiragi', classIds: [63, 65, 61] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL },
  ],
  [KIRAGI]: [
    { source: 'own', label: 'Own · Archer', classIds: [63, 65, 61] },
    { source: 'parent', label: 'Parent · Oboro', classIds: [45, 43, 47] },
    { source: 'parent', label: 'Parent · Takumi', classIds: [63, 65, 61], note: 'shared with own branch' },
    { source: 'friendship', label: 'Friendship Seal · Shiro', classIds: [33, 31, 35] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL },
  ],
  [KAZE]: [
    { source: 'own', label: 'Own · Ninja', classIds: [75, 73, 77] },
    { source: 'secondary', label: 'Own · Samurai', classIds: [33, 31, 35] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL },
  ],
  [SAIZO]: [
    { source: 'own', label: 'Own · Ninja', classIds: [75, 73, 77] },
    { source: 'secondary', label: 'Own · Samurai', classIds: [33, 31, 35] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL },
  ],
  [CORRIN]: [
    { source: 'own', label: 'Own · Nohr Prince', classIds: [3, 1, 5] },
    { source: 'talent', label: 'Talent · Ninja', classIds: [75, 73, 77] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL },
  ],
  [AZURA]: [
    { source: 'own', label: 'Own · Songstress', classIds: [103] },
    { source: 'secondary', label: 'Own · Sky Knight', classIds: [60, 58, 62] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL_F },
  ],
  [XANDER]: [
    { source: 'own', label: 'Own · Cavalier', classIds: [9, 7, 11] },
    { source: 'secondary', label: 'Own · Wyvern Rider', classIds: [69, 67, 71] },
    { source: 'friendship', label: 'Friendship Seal · Ryoma', classIds: [33, 31, 35] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL },
  ],
  [TAKUMI]: [
    { source: 'own', label: 'Own · Archer', classIds: [63, 65, 61] },
    { source: 'secondary', label: 'Own · Spear Fighter', classIds: [45, 43, 47] },
    { source: 'partner', label: 'Partner Seal · Oboro', classIds: [79, 81], note: 'secondary branch — Spear Fighter is shared' },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL },
  ],
  [HINOKA]: [
    { source: 'own', label: 'Own · Sky Knight', classIds: [60, 58, 62] },
    { source: 'secondary', label: 'Own · Spear Fighter', classIds: [46, 44, 48] },
    { source: 'friendship', label: 'Friendship Seal · Subaki', classIds: [34, 32, 36] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL_F },
  ],
  [OBORO]: [
    { source: 'own', label: 'Own · Spear Fighter', classIds: [46, 44, 48] },
    { source: 'secondary', label: 'Own · Apothecary', classIds: [80, 82] },
    { source: 'partner', label: 'Partner Seal · Takumi', classIds: [64, 66, 62] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL_F },
  ],
  [NILES]: [
    { source: 'own', label: 'Own · Outlaw', classIds: [27, 29, 25] },
    { source: 'secondary', label: 'Own · Dark Mage', classIds: [85, 83, 87] },
    { source: 'partner', label: 'Partner Seal · Corrin', classIds: [3, 1, 5] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL },
  ],
  [SELENA]: [
    { source: 'own', label: 'Own · Mercenary', classIds: [24, 22, 26] },
    { source: 'secondary', label: 'Own · Sky Knight', classIds: [60, 58, 62] },
    { source: 'partner', label: 'Partner Seal · Shiro', classIds: [46, 44, 48] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL_F },
  ],
  [SUBAKI]: [
    { source: 'own', label: 'Own · Sky Knight', classIds: [59, 57, 61] },
    { source: 'secondary', label: 'Own · Samurai', classIds: [33, 31, 35] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL },
  ],
  [SETSUNA]: [
    { source: 'own', label: 'Own · Archer', classIds: [64, 66, 62] },
    { source: 'secondary', label: 'Own · Ninja', classIds: [76, 74, 78] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL_F },
  ],
  [KANA]: [
    { source: 'own', label: 'Own · Nohr Princess', classIds: [4, 2, 6] },
    { source: 'parent', label: 'Parent · Corrin', classIds: [76, 74, 78], note: "Corrin's talent" },
    { source: 'parent', label: 'Parent · Niles', classIds: [28, 30, 26] },
    { source: 'dlc', label: 'DLC', classIds: DLC_POOL_F },
  ],
}

// ── plans ──────────────────────────────────────────────────────────────────
export type SealKind =
  | 'start'
  | 'promotion'
  | 'heart'
  | 'partner'
  | 'friendship'
  | 'master'
  | 'eternal'
  | 'offspring'
  | 'dlc'

export const SEAL_LABELS: Record<SealKind, string> = {
  start: 'Start',
  promotion: 'Promotion',
  heart: 'Heart Seal',
  partner: 'Partner Seal',
  friendship: 'Friendship Seal',
  master: 'Master Seal',
  eternal: 'Eternal Seal',
  offspring: 'Offspring Seal',
  dlc: 'DLC seal',
}

export interface FixtureStop {
  classId: number
  fromLevel: number
  toLevel: number
  via: SealKind
  viaNote?: string
}

export interface FixturePlan {
  sPartner?: string
  aPlusPartner?: string
  variableParent?: string
  combatPartner?: string
  combatRole: 'front' | 'back'
  classId?: number
  levelFrom?: number
  levelTo?: number
  skills: (number | null)[]
  inherit?: { fixed?: number; variable?: number }
  route: FixtureStop[]
}

export const INITIAL_PLANS: Record<string, FixturePlan> = {
  [RYOMA]: {
    sPartner: CAMILLA,
    aPlusPartner: XANDER,
    combatPartner: CAMILLA,
    combatRole: 'front',
    classId: 31,
    levelFrom: 15,
    levelTo: 20,
    skills: [65, 39, 27, 9, null],
    route: [
      { classId: 33, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 31, fromLevel: 1, toLevel: 15, via: 'master' },
    ],
  },
  [CAMILLA]: {
    sPartner: RYOMA,
    combatPartner: RYOMA,
    combatRole: 'back',
    classId: 72,
    levelFrom: 15,
    levelTo: 20,
    skills: [2, 46, 102, 63, null],
    route: [
      { classId: 70, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 72, fromLevel: 1, toLevel: 15, via: 'master' },
    ],
  },
  [SHIRO]: {
    sPartner: SELENA,
    aPlusPartner: KIRAGI,
    variableParent: CAMILLA,
    combatPartner: KIRAGI,
    combatRole: 'front',
    classId: 71,
    levelFrom: 15,
    levelTo: 20,
    skills: [47, 121, 102, 63, null],
    inherit: { fixed: 65, variable: 102 },
    route: [
      { classId: 45, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 43, fromLevel: 1, toLevel: 15, via: 'master' },
      { classId: 71, fromLevel: 15, toLevel: 20, via: 'heart', viaNote: 'via Camilla' },
    ],
  },
  [KIRAGI]: {
    sPartner: SELENA,
    aPlusPartner: SHIRO,
    variableParent: OBORO,
    combatPartner: SHIRO,
    combatRole: 'back',
    classId: 65,
    levelFrom: 15,
    levelTo: 20,
    skills: [4, 49, 60, 69, null],
    inherit: { fixed: 69, variable: 66 },
    route: [
      { classId: 63, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 65, fromLevel: 1, toLevel: 15, via: 'master' },
    ],
  },
  [KAZE]: {
    aPlusPartner: SAIZO,
    combatRole: 'front',
    classId: 73,
    levelFrom: 10,
    levelTo: 20,
    skills: [112, 101, 25, 68, null],
    route: [
      { classId: 75, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 73, fromLevel: 1, toLevel: 15, via: 'master' },
    ],
  },
  [SAIZO]: {
    aPlusPartner: KAZE,
    combatRole: 'front',
    classId: 73,
    levelFrom: 10,
    levelTo: 20,
    skills: [112, 101, 25, 68, null],
    route: [
      { classId: 75, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 73, fromLevel: 1, toLevel: 15, via: 'master' },
    ],
  },
  [CORRIN]: {
    sPartner: NILES,
    combatRole: 'front',
    classId: 1,
    levelFrom: 15,
    levelTo: 20,
    skills: [28, 42, 112, 101, null],
    route: [
      { classId: 3, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 1, fromLevel: 1, toLevel: 15, via: 'master' },
    ],
  },
  [AZURA]: {
    combatRole: 'front',
    classId: 103,
    levelFrom: 10,
    levelTo: 20,
    skills: [6, 24, 77, 78, null],
    route: [{ classId: 103, fromLevel: 1, toLevel: 20, via: 'start' }],
  },
  [XANDER]: {
    aPlusPartner: RYOMA,
    combatRole: 'front',
    classId: 7,
    levelFrom: 15,
    levelTo: 20,
    skills: [51, 44, 71, 34, null],
    route: [
      { classId: 9, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 7, fromLevel: 1, toLevel: 15, via: 'master' },
    ],
  },
  [TAKUMI]: {
    sPartner: OBORO,
    combatPartner: OBORO,
    combatRole: 'front',
    classId: 65,
    levelFrom: 15,
    levelTo: 20,
    skills: [4, 49, 60, 69, null],
    route: [
      { classId: 63, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 65, fromLevel: 1, toLevel: 15, via: 'master' },
    ],
  },
  [HINOKA]: {
    aPlusPartner: SUBAKI,
    combatRole: 'front',
    classId: 58,
    levelFrom: 15,
    levelTo: 20,
    skills: [58, 93, 19, 62, null],
    route: [
      { classId: 60, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 58, fromLevel: 1, toLevel: 15, via: 'master' },
    ],
  },
  [OBORO]: {
    sPartner: TAKUMI,
    combatPartner: TAKUMI,
    combatRole: 'back',
    classId: 44,
    levelFrom: 15,
    levelTo: 20,
    skills: [14, 47, 13, 66, null],
    route: [
      { classId: 46, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 44, fromLevel: 1, toLevel: 15, via: 'master' },
    ],
  },
  [NILES]: {
    sPartner: CORRIN,
    combatRole: 'front',
    classId: 29,
    levelFrom: 10,
    levelTo: 20,
    skills: [112, 9, 87, 111, null],
    route: [
      { classId: 27, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 29, fromLevel: 1, toLevel: 15, via: 'master' },
    ],
  },
  [SELENA]: {
    sPartner: SHIRO,
    combatRole: 'front',
    classId: 22,
    levelFrom: 15,
    levelTo: 20,
    skills: [91, 50, 29, 81, null],
    route: [
      { classId: 24, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 22, fromLevel: 1, toLevel: 15, via: 'master' },
    ],
  },
  [SUBAKI]: {
    aPlusPartner: HINOKA,
    combatRole: 'front',
    classId: 57,
    levelFrom: 15,
    levelTo: 20,
    skills: [58, 93, 19, 62, null],
    route: [
      { classId: 59, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 57, fromLevel: 1, toLevel: 15, via: 'master' },
    ],
  },
  [SETSUNA]: {
    aPlusPartner: SUBAKI,
    combatRole: 'front',
    classId: 66,
    levelFrom: 15,
    levelTo: 20,
    skills: [4, 49, 60, 69, null],
    route: [
      { classId: 64, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 66, fromLevel: 1, toLevel: 15, via: 'master' },
    ],
  },
  [KANA]: {
    variableParent: NILES,
    combatRole: 'back',
    classId: 4,
    levelFrom: 10,
    levelTo: 20,
    skills: [106, 28, 112, 101, null],
    inherit: { fixed: 160, variable: 190 },
    route: [
      { classId: 4, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 2, fromLevel: 1, toLevel: 15, via: 'master' },
    ],
  },
}

// ── relationships ──────────────────────────────────────────────────────────
export interface FixturePair {
  id: string
  a: string
  b: string
  childId?: string
  variableParentId?: string
}

export const PAIRS: FixturePair[] = [
  { id: 'pair-ryoma-camilla', a: RYOMA, b: CAMILLA, childId: SHIRO, variableParentId: CAMILLA },
  { id: 'pair-takumi-oboro', a: TAKUMI, b: OBORO, childId: KIRAGI, variableParentId: OBORO },
  { id: 'pair-shiro-selena', a: SHIRO, b: SELENA },
  { id: 'pair-corrin-niles', a: CORRIN, b: NILES, childId: KANA, variableParentId: NILES },
]

export interface FixtureConflict {
  id: string
  unitIds: string[]
  message: string
}

export const CONFLICTS: FixtureConflict[] = [
  {
    id: 'conflict-kiragi-selena',
    unitIds: [KIRAGI, SELENA],
    message: 'Kiragi lists Selena as S, but Selena is married to Shiro.',
  },
  {
    id: 'conflict-subaki-ap',
    unitIds: [SUBAKI, HINOKA, SETSUNA],
    message: 'Subaki is claimed as A+ by both Hinoka and Setsuna — friendship is exclusive.',
  },
]

export interface FixtureChildPreview {
  childId: string
  growths: number[]
  offeredClassId: number
  personalSkillId: number
}

const childKey = (a: string, b: string) => [a, b].sort().join('|')

export const CHILD_PREVIEWS: Record<string, FixtureChildPreview> = {
  [childKey(RYOMA, CAMILLA)]: {
    childId: SHIRO,
    growths: [45, 50, 12, 45, 45, 30, 40, 37],
    offeredClassId: 69,
    personalSkillId: 212,
  },
  [childKey(TAKUMI, OBORO)]: {
    childId: KIRAGI,
    growths: [37, 40, 10, 42, 45, 42, 40, 22],
    offeredClassId: 45,
    personalSkillId: 213,
  },
  [childKey(CORRIN, NILES)]: {
    childId: KANA,
    growths: [35, 35, 25, 40, 47, 37, 27, 32],
    offeredClassId: 28,
    personalSkillId: 207,
  },
}

// ── preview ────────────────────────────────────────────────────────────────
export interface FixtureDuo {
  id: string
  front: string
  back: string
}

export const PREVIEW_DUOS: FixtureDuo[] = [
  { id: 'duo-shiro-kiragi', front: SHIRO, back: KIRAGI },
  { id: 'duo-ryoma-camilla', front: RYOMA, back: CAMILLA },
  { id: 'duo-takumi-oboro', front: TAKUMI, back: OBORO },
]

// ── Corrin ─────────────────────────────────────────────────────────────────
export const CORRIN_DEFAULTS = {
  gender: 'male' as const,
  boon: 'spd' as StatKey,
  bane: 'lck' as StatKey,
  talentClassId: 75,
  spouseId: NILES,
}

export const TALENT_OPTIONS: number[] = [75, 73, 77, 85, 83, 63, 65, 33, 59, 45, 27, 24, 9, 13, 19, 53, 54, 92, 103]

// ── unit screen numbers ────────────────────────────────────────────────────
export interface FixtureStatOverride {
  value: number
  personal: number
  classGrowth: number
  cap: number
  delta?: number
}

/** docs/design/reference.html sample: Shiro as a Malig Knight at Lv 20 avg. */
export const SHIRO_STATS: FixtureStatOverride[] = [
  { value: 60, personal: 45, classGrowth: 0, cap: 60 },
  { value: 31, personal: 50, classGrowth: 15, cap: 34, delta: 2 },
  { value: 14, personal: 12, classGrowth: 15, cap: 28 },
  { value: 26, personal: 45, classGrowth: 10, cap: 31 },
  { value: 24, personal: 45, classGrowth: 5, cap: 28, delta: 1 },
  { value: 17, personal: 30, classGrowth: 0, cap: 27 },
  { value: 30, personal: 40, classGrowth: 5, cap: 33 },
  { value: 19, personal: 37, classGrowth: 5, cap: 28 },
]

/** Pair-up bonus deltas by unit (reference sample); else the partner class's row. */
export const PAIRUP_DELTAS: Record<string, number[]> = {
  [SHIRO]: [0, 2, 0, 0, 1, 0, 0, 0],
}

// ── list controls ──────────────────────────────────────────────────────────
export interface FixtureFilter {
  id: string
  label: string
  warn?: boolean
}

export const FILTERS: FixtureFilter[] = [
  { id: 'all', label: 'All' },
  { id: 'unpaired', label: 'Unpaired' },
  { id: 'children', label: 'Children' },
  { id: 'magic', label: 'Magic' },
  { id: 'conflicts', label: 'conflicts', warn: true },
]

export interface FixtureSort {
  id: string
  label: string
  stat: StatKey | 'name'
}

export const SORTS: FixtureSort[] = [
  { id: 'spd', label: 'Spd', stat: 'spd' },
  { id: 'str', label: 'Str', stat: 'str' },
  { id: 'mag', label: 'Mag', stat: 'mag' },
  { id: 'skl', label: 'Skl', stat: 'skl' },
  { id: 'def', label: 'Def', stat: 'def' },
  { id: 'res', label: 'Res', stat: 'res' },
  { id: 'name', label: 'Name', stat: 'name' },
]

// ── class route ────────────────────────────────────────────────────────────
export const ROUTE_SKILL_WARNING = {
  skillId: 46,
  classId: 69,
  level: 10,
}

/** Skills a plan wants but has not equipped (drives the route validation copy). */
export const WANTED_SKILLS: Record<string, number[]> = {
  [SHIRO]: [46],
}

export const ROUTE_ILLEGAL_WARNING = {
  fromClassId: 71,
  toClassId: 43,
  message: 'Malig Knight → Spear Master needs at least level 15 and a Heart Seal; base classes reset to 1.',
}

export const STAT_LABEL_SHORT: Record<StatKey, string> = {
  hp: 'HP',
  str: 'STR',
  mag: 'MAG',
  skl: 'SKL',
  spd: 'SPD',
  lck: 'LCK',
  def: 'DEF',
  res: 'RES',
}

export const STAT_KEYS_ORDER: StatKey[] = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res']

export type FixtureTier = ClassTier
