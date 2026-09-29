/**
 * The view-model contract between screens and the (future) store.
 *
 * Every screen reads exactly one hook from src/viewmodels/ and renders the VM
 * below. Wiring later = replacing hook bodies with plansStore selectors and
 * actions; screen and component files should not change. Every interactive
 * affordance carries its own callback so the seam stays prop-only.
 */
import type { ClassTier, Route, StatKey } from '../data/types'
import type { ClassSourceId } from '../prototype/fixtures'

export type Tone = 'hoshido' | 'nohr'

export interface SpriteVM {
  label: string
  src?: string
  tone?: Tone
}

export interface RunPillVM {
  runName: string
  crest: string
  modpackLabel: string
  dlc: boolean
  route: Route
  routeLabel: string
  readOnly?: boolean
  onOpenRuns(): void
  onOpenSetup(): void
}

// ── setup ──────────────────────────────────────────────────────────────────
export interface ModpackOptionVM {
  id: string
  label: string
  blurb: string
  installed: boolean
  supportNote: string
  selected: boolean
  onSelect(): void
}

export interface RouteOptionVM {
  id: Route
  label: string
  blurb: string
  selected: boolean
  onSelect(): void
}

export interface SetupStepVM {
  id: 'modpack' | 'dlc' | 'route' | 'run'
  index: number
  label: string
  hint: string
  done: boolean
}

export interface SetupVM {
  runPill: RunPillVM
  steps: SetupStepVM[]
  modpacks: ModpackOptionVM[]
  dlc: boolean
  onToggleDlc(): void
  routes: RouteOptionVM[]
  runName: string
  onSetRunName(name: string): void
  firstRun: boolean
  onFinish(): void
  onSkip(): void
  dlcWarning: string | null
}

// ── runs ───────────────────────────────────────────────────────────────────
export interface RunSummaryVM {
  id: string
  name: string
  modpackLabel: string
  routeLabel: string
  dlc: boolean
  updatedAt: string
  unitCount: number
  pairCount: number
  active: boolean
  onSelect(): void
  onDuplicate(): void
  onDelete(): void
  onExport(): void
}

export interface RunsVM {
  runs: RunSummaryVM[]
  activeRunId: string
  onOpenSetup(): void
  onCreateRun(): void
  onImport(): void
  onShareLink(): void
  copied: boolean
  shareHint: string
}

// ── shared pieces ──────────────────────────────────────────────────────────
export interface FilterChipVM {
  id: string
  label: string
  count: number
  warn: boolean
  active: boolean
  onSelect(): void
}

export interface SortOptionVM {
  id: string
  label: string
  active: boolean
  onSelect(): void
}

export interface UnitSummaryVM {
  id: string
  name: string
  sprite: SpriteVM
  classChips: string[]
  personalSkill: string
  growths: number[]
  bestStatIndex: number
  capMods: number[]
  pinned: boolean
  rank: 'S' | 'A+' | null
  conflict?: string
  onOpen(): void
  onTogglePin(): void
}

export interface CompareColumnVM {
  id: string
  name: string
  sprite: SpriteVM
  growths: number[]
  offer: string
  offerSkill: string
  personalSkill: string
  isChildPreview?: boolean
}

export interface CompareTrayVM {
  columns: CompareColumnVM[]
  pinnedCount: number
  child: { id: string; name: string; growths: number[]; inherits: string } | null
  onUnpin(id: string): void
  onClear(): void
  onOpenUnit(id: string): void
}

export interface PartnerOptionVM {
  id: string
  name: string
  sprite: SpriteVM
  romantic: boolean
  fast: boolean
  hasS: boolean
  hasA: boolean
  current: 'S' | 'A+' | null
  onPick(): void
}

export interface PartnerSheetVM {
  unitId: string
  unitName: string
  rank: 'S' | 'A+' | 'Parent'
  options: PartnerOptionVM[]
  onClose(): void
  onClear(): void
}

export interface PairCardVM {
  id: string
  a: { id: string; name: string; sprite: SpriteVM; onOpen(): void; onOpenPartner(): void }
  b: { id: string; name: string; sprite: SpriteVM; onOpen(): void; onOpenPartner(): void }
  child: {
    id: string
    name: string
    sprite: SpriteVM
    inheritedClass: string
    growths: number[]
    conflict?: string
    onOpen(): void
  } | null
  onOpenUnit(id: string): void
}

export interface ConflictVM {
  id: string
  message: string
  onOpen(): void
}

export interface CorrinCardVM {
  unitId: string
  name: string
  sprite: SpriteVM
  gender: 'male' | 'female'
  onSetGender(gender: 'male' | 'female'): void
  boons: { key: StatKey; label: string; active: boolean; onSelect(): void }[]
  banes: { key: StatKey; label: string; active: boolean; onSelect(): void }[]
  talent: string
  spouse: string
  childName: string
  onOpenTalent(): void
  onOpenSpouse(): void
}

export interface TalentSheetVM {
  options: { classId: number; name: string; sprite: SpriteVM; current: boolean; onPick(): void }[]
  onClose(): void
}

export interface CombatSheetVM {
  unitId: string
  options: { id: string; name: string; sprite: SpriteVM; current: boolean; onPick(): void }[]
  onClear(): void
  onClose(): void
}

export interface PairingsVM {
  runPill: RunPillVM
  query: string
  onSearch(query: string): void
  sortLabel: string
  sorts: SortOptionVM[]
  filters: FilterChipVM[]
  units: UnitSummaryVM[]
  totalCount: number
  empty: 'none' | 'filtered' | 'roster'
  onClearFilters(): void
  tray: CompareTrayVM | null
  pairCards: PairCardVM[]
  conflicts: ConflictVM[]
  corrin: CorrinCardVM | null
  dlc: boolean
  partnerSheet: PartnerSheetVM | null
  talentSheet: TalentSheetVM | null
  onOpenRuns(): void
  onOpenSetup(): void
}

// ── individual ─────────────────────────────────────────────────────────────
export interface RelationshipChipVM {
  id: string
  label: string
  value: string
  rank?: 'S' | 'A+'
  tone: 'plain' | 'accent' | 'fixed'
  onOpen?: () => void
}

export interface ClassOptionVM {
  key: string
  classId: number
  name: string
  sprite: SpriteVM
  tier: ClassTier
  tierLabel: string
  source: ClassSourceId
  dlc: boolean
  growths: number[]
  growthTotal: number
  caps: number[]
  skills: { id: number; name: string; short: string }[]
  selected: boolean
  compareState: 'none' | 'a' | 'b'
  hiddenByDlc: boolean
  onSelect(): void
  onCompare(): void
}

export interface ClassGroupVM {
  id: string
  label: string
  source: ClassSourceId
  note?: string
  options: ClassOptionVM[]
}

export interface ClassCompareVM {
  columns: { classId: number; name: string; sprite: SpriteVM }[]
  rows: { label: string; values: string[]; bestIndex: number }[]
  onClear(): void
}

export interface StatRowVM {
  key: StatKey
  label: string
  value: number
  personalGrowth: number
  classGrowth: number
  cap: number
  capMod: number
  delta?: number
}

export interface StatPanelVM {
  level: number
  levels: number[]
  onSetLevel(level: number): void
  rows: StatRowVM[]
  partnerNote: string | null
}

export interface SkillSlotVM {
  slot: number
  skill: { id: number; name: string; short: string; source: string } | null
  onOpen(): void
  onClear(): void
}

export interface SkillOptionVM {
  id: number
  name: string
  short: string
  source: string
  classId: number
  dlc: boolean
  reached: boolean
  equipped: boolean
  onPick(): void
  onAddStop?(): void
}

export interface SkillPickerVM {
  slot: number
  options: SkillOptionVM[]
  groups: { id: string; label: string; options: SkillOptionVM[] }[]
  onClearSlot(): void
  onClose(): void
}

export interface InheritanceVM {
  rule: string
  fixedParent: { name: string; sprite: SpriteVM; skill: { id: number; name: string; short: string } | null }
  variableParent: { name: string; sprite: SpriteVM; skill: { id: number; name: string; short: string } | null }
  branches: string[]
}

export interface WarningVM {
  id: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export interface UnitVM {
  id: string
  name: string
  sprite: SpriteVM
  className: string
  levelLabel: string
  isChild: boolean
  relationships: RelationshipChipVM[]
  classGroups: ClassGroupVM[]
  compare: ClassCompareVM | null
  stats: StatPanelVM
  skills: {
    slots: SkillSlotVM[]
    personal: { id: number; name: string; short: string }
    onOpenPicker(slot: number): void
  }
  skillPicker: SkillPickerVM | null
  inheritance: InheritanceVM | null
  combat: {
    partnerName: string | null
    role: 'front' | 'back'
    onSetRole(role: 'front' | 'back'): void
    onOpenPartnerPicker(): void
  }
  combatSheet: CombatSheetVM | null
  partnerSheet: PartnerSheetVM | null
  warnings: WarningVM[]
  onOpenRoute(): void
  onBack(): void
}

// ── class route ────────────────────────────────────────────────────────────
export interface RouteStopVM {
  id: string
  classId: number
  name: string
  sprite: SpriteVM
  fromLevel: number
  toLevel: number
  seal: string
  done: boolean
  dlc: boolean
  skills: { id: number; name: string; short: string; learnLabel: string }[]
  onRemove(): void
}

export interface AddStopOptionVM {
  classId: number
  name: string
  sprite: SpriteVM
  source: string
  sourceLabel: string
  seal: string
  dlc: boolean
  onPick(): void
}

export interface ClassRouteVM {
  unit: { id: string; name: string; sprite: SpriteVM }
  stops: RouteStopVM[]
  warnings: WarningVM[]
  addStopOpen: boolean
  addStopOptions: AddStopOptionVM[]
  onOpenAddStop(): void
  onCloseAddStop(): void
  onOpenUnit(): void
  onBack(): void
}

// ── preview ────────────────────────────────────────────────────────────────
export interface PreviewFactVM {
  label: string
  value: string
  soft?: boolean
}

export interface PreviewSlotVM {
  id: string
  name: string
  sprite: SpriteVM
  role: 'Front' | 'Back' | 'Solo'
  facts: PreviewFactVM[]
  hanko: 'S' | 'A+' | null
  conflict?: string
  onOpen(): void
}

export interface DuoVM {
  id: string
  front: PreviewSlotVM
  back: PreviewSlotVM
}

export interface PreviewVM {
  runPill: RunPillVM
  duoCount: number
  soloCount: number
  unassignedCount: number
  duos: DuoVM[]
  solos: PreviewSlotVM[]
  unassigned: PreviewSlotVM[]
  copied: boolean
  onCopyLink(): void
  onPrint(): void
}
