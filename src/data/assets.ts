import manifestJson from './assets.json'

export type AssetKind = 'skill' | 'class' | 'unit'

export interface AssetEntry {
  /** Path relative to the site base, e.g. "assets/skills/131.webp". */
  file: string
  /** Provenance: game file + sub-resource this asset was extracted from. */
  source: string
}

export interface AssetManifest {
  generatedAt: string
  source: string
  coverage: Record<string, { resolved: number; total: number }>
  skills: Record<string, AssetEntry>
  classes: Record<string, AssetEntry>
  units: Record<string, AssetEntry>
}

export const ASSET_MANIFEST = manifestJson as AssetManifest

const BASE_URL = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

export function assetEntry(kind: AssetKind, id: string | number): AssetEntry | undefined {
  const entries =
    kind === 'skill'
      ? ASSET_MANIFEST.skills
      : kind === 'class'
        ? ASSET_MANIFEST.classes
        : ASSET_MANIFEST.units
  return entries[String(id)]
}

export function assetUrl(kind: AssetKind, id: string | number): string | undefined {
  const entry = assetEntry(kind, id)
  return entry ? `${BASE_URL}${entry.file}?v=${encodeURIComponent(ASSET_MANIFEST.generatedAt)}` : undefined
}
