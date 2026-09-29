import type {
  CharacterDef,
  ClassDef,
  Dataset,
  DatasetEdge,
  DatasetMeta,
  RawSupportTuple,
  RecruitmentEntry,
  Route,
  SkillDef,
  UnitDef,
} from './types'
import { decodeSupportType } from './types'

/**
 * Datasets are lazy-loaded as async chunks so the app shell stays small.
 * Add a new pack by creating src/data/packs/<id>/ (+ a branch in loadDataset).
 */

const cache = new Map<string, Promise<Dataset>>()

// Optional pack files: absent files simply resolve to null instead of failing the build.
const recruitmentFiles = import.meta.glob<{ default: unknown }>('./packs/*/recruitment.json')

async function loadRecruitment(packId: string): Promise<Dataset['recruitment']> {
  const load = recruitmentFiles[`./packs/${packId}/recruitment.json`]
  if (!load) return null
  const { routes } = (await load()).default as { routes: Record<Route, RecruitmentEntry[]> }
  const index = (entries: RecruitmentEntry[] = []) => new Map(entries.map((entry) => [entry.unit, entry]))
  return { birthright: index(routes.birthright), conquest: index(routes.conquest), revelation: index(routes.revelation) }
}

export function loadDataset(packId: string): Promise<Dataset> {
  const hit = cache.get(packId)
  if (hit) return hit
  const promise = packId === 'ugf-2.5.2' ? loadUgfPack() : Promise.resolve(pendingPack(packId))
  cache.set(packId, promise)
  return promise
}

function indexEdges(edges: DatasetEdge[]): Map<string, DatasetEdge[]> {
  const byCharacter = new Map<string, DatasetEdge[]>()
  for (const edge of edges) {
    for (const id of [edge.a, edge.b]) {
      const list = byCharacter.get(id)
      if (list) list.push(edge)
      else byCharacter.set(id, [edge])
    }
  }
  return byCharacter
}

async function loadUgfPack(): Promise<Dataset> {
  const [metaModule, charactersModule, supportsModule, unitsModule, classesModule, skillsModule, recruitment] =
    await Promise.all([
      import('./packs/ugf-2.5.2/meta.json'),
      import('./packs/ugf-2.5.2/characters.json'),
      import('./packs/ugf-2.5.2/supports.json'),
      import('./packs/ugf-2.5.2/units.json'),
      import('./packs/ugf-2.5.2/classes.json'),
      import('./packs/ugf-2.5.2/skills.json'),
      loadRecruitment('ugf-2.5.2'),
    ])

  const meta = metaModule.default as unknown as DatasetMeta
  const characters = charactersModule.default as unknown as CharacterDef[]
  const tuples = (supportsModule.default as unknown as { edges: RawSupportTuple[] }).edges
  const units = (unitsModule.default as unknown as { units: UnitDef[] }).units
  const classes = (classesModule.default as unknown as { classes: ClassDef[] }).classes
  const skills = (skillsModule.default as unknown as { skills: SkillDef[] }).skills

  const edges: DatasetEdge[] = tuples.map(([a, b, raw]) => ({
    a: characters[a].id,
    b: characters[b].id,
    raw,
    info: decodeSupportType(raw),
  }))

  return {
    meta,
    characters,
    edges,
    edgesByCharacter: indexEdges(edges),
    units,
    unitsById: new Map(units.map((u) => [u.id, u])),
    classes,
    classesById: new Map(classes.map((c) => [c.id, c])),
    skillsById: new Map(skills.map((s) => [s.id, s])),
    recruitment,
  }
}

function pendingPack(packId: string): Dataset {
  return {
    meta: {
      id: packId,
      label: 'Vanilla dataset — extraction pending',
      status: 'pending',
      notes: ['See docs/DATA.md for the extraction pipeline.'],
    },
    characters: [],
    edges: [],
    edgesByCharacter: new Map(),
    units: [],
    unitsById: new Map(),
    classes: [],
    classesById: new Map(),
    skillsById: new Map(),
    recruitment: null,
  }
}

/** Kana-aware sort for the character names. */
const collator = new Intl.Collator('en')

export function sortCharacters(characters: CharacterDef[]): CharacterDef[] {
  return [...characters].sort((x, y) => collator.compare(x.name, y.name))
}

export function sortUnits(units: UnitDef[]): UnitDef[] {
  return [...units].sort((x, y) => collator.compare(x.name, y.name))
}

export function sortClasses(classes: ClassDef[]): ClassDef[] {
  return [...classes].sort((x, y) => collator.compare(x.name, y.name))
}

export function sortSkills(skills: SkillDef[]): SkillDef[] {
  return [...skills].sort((x, y) => collator.compare(x.name, y.name))
}
