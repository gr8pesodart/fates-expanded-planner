import type { CharacterDef, Dataset, DatasetEdge, DatasetMeta, RawSupportTuple } from './types'
import { decodeSupportType } from './types'

/**
 * Datasets are lazy-loaded as async chunks so the app shell stays small.
 * Add a new pack by creating src/data/packs/<id>/ (+ a branch in loadDataset).
 */

const cache = new Map<string, Promise<Dataset>>()

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
  const [metaModule, charactersModule, supportsModule] = await Promise.all([
    import('./packs/ugf-2.5.2/meta.json'),
    import('./packs/ugf-2.5.2/characters.json'),
    import('./packs/ugf-2.5.2/supports.json'),
  ])

  const meta = metaModule.default as unknown as DatasetMeta
  const characters = charactersModule.default as unknown as CharacterDef[]
  const tuples = (supportsModule.default as unknown as { edges: RawSupportTuple[] }).edges

  const edges: DatasetEdge[] = tuples.map(([a, b, raw]) => ({
    a: characters[a].id,
    b: characters[b].id,
    raw,
    info: decodeSupportType(raw),
  }))

  return { meta, characters, edges, edgesByCharacter: indexEdges(edges) }
}

function pendingPack(packId: string): Dataset {
  return {
    meta: {
      id: packId,
      label: 'Vanilla dataset — extraction pending',
      status: 'pending',
      notes: [
        'Run Paragon on the clean GameData (or extend tools/extract) to produce this pack.',
        'See docs/DATA.md for the extraction pipeline.',
      ],
    },
    characters: [],
    edges: [],
    edgesByCharacter: new Map(),
  }
}

/** Kana-aware sort for the mostly-Japanese character names. */
const collator = new Intl.Collator('ja')

export function sortCharacters(characters: CharacterDef[]): CharacterDef[] {
  return [...characters].sort((x, y) => collator.compare(x.name, y.name))
}

export function findCharacter(dataset: Dataset, id: string): CharacterDef | undefined {
  return dataset.characters.find((c) => c.id === id)
}

export function edgePartner(edge: DatasetEdge, id: string): string {
  return edge.a === id ? edge.b : edge.a
}
