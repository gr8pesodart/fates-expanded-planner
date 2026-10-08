/**
 * Build profiles describe which version of the game a plan targets.
 * Sourced from the fe-fates build (see docs/MODS.md): every entry below is
 * what the installed CIA / Citra mods actually change.
 */

export interface ModEntry {
  id: string
  name: string
  version?: string
  /** What it changes, in planner-relevant terms. */
  effect: string
  /** Planner rules or alternate game art. */
  category: 'data' | 'vanity'
  required?: boolean
  url?: string
}

export interface BuildFeatures {
  /** UGF's expanded support graph (same-sex S supports, extra conversations). */
  expandedSupports: boolean
  /** The installed class patch adds six opposite-gender DLC jobs. */
  unisexDlcClasses: boolean
}

export interface BuildProfile {
  id: string
  label: string
  short: string
  /** Dataset pack id used when this profile is active. */
  packId: string
  features: BuildFeatures
  mods: ModEntry[]
  notes: string[]
}

const UGF_BUILD: BuildProfile = {
  id: 'ugf-2.5.2',
  label: 'Modded build — UGF 2.5.2 (installed)',
  short: 'UGF build',
  packId: 'ugf-2.5.2',
  features: {
    expandedSupports: true,
    unisexDlcClasses: true,
  },
  mods: [
    {
      id: 'ugf',
      name: 'Unofficial Gay Fates',
      version: '2.5.2',
      effect:
        'Expands the support graph: same-sex S supports, new conversation sets, extra Corrin / child / sibling supports, adjusted support routes.',
      category: 'data',
      required: true,
      url: 'https://gamebanana.com/mods/51420',
    },
    {
      id: 'unisex-dlc-classes',
      name: 'Unisex DLC Classes',
      version: '2024-07-24',
      effect: 'Opens Ballistician, Witch, Lodestar, Vanguard, Great Lord and Grandmaster to both genders.',
      category: 'data',
      url: 'https://gamebanana.com/mods/324622',
    },
    {
      id: 'furry-fates',
      name: 'Furry Fates',
      version: '2.2',
      effect: 'Alternate art for Kaden, Keaton, Selkie and Velouria, with map sprites for Kaden and Keaton.',
      category: 'vanity',
      url: 'https://gamebanana.com/mods/663124',
    },
    {
      id: 'dragon-hare-corrin',
      name: 'Dragon-Hare Corrin',
      version: '5.0',
      effect: 'Alternate portraits for male and female Corrin.',
      category: 'vanity',
      url: 'https://gamebanana.com/mods/653924',
    },
  ],
  notes: [
    'UGF is installed without the optional Corrinsexual Rebalance, so vanilla base stats/growths are unchanged.',
    'Body Accessories was intentionally excluded (conflicts with Texture Compilation); Tru’s Shop is used instead.',
    'Verify support edges against the extracted pack; UGF changes are authoritative for this build.',
  ],
}

const VANILLA: BuildProfile = {
  id: 'vanilla',
  label: 'Vanilla Special Edition (dataset pending)',
  short: 'Vanilla',
  packId: 'vanilla',
  features: {
    expandedSupports: false,
    unisexDlcClasses: false,
  },
  mods: [],
  notes: [
    'Vanilla-data extraction is planned: diff the clean GameData against the modded one (docs/DATA.md).',
    'Legacy runs marked vanilla use the installed UGF dataset until a vanilla pack is available.',
  ],
}

export const BUILD_PROFILES: readonly BuildProfile[] = [UGF_BUILD, VANILLA]

export function getBuildProfile(_id: string): BuildProfile {
  return UGF_BUILD
}

export function selectedModIds(_profileId: string, saved?: readonly string[]): string[] {
  const profile = UGF_BUILD
  const chosen = new Set(saved ?? profile.mods.map((mod) => mod.id))
  return profile.mods.filter((mod) => mod.required || chosen.has(mod.id)).map((mod) => mod.id)
}

/** The run's mod list opens the six opposite-gender DLC jobs (the class's own map still has to be on). */
export function hasUnisexDlcClasses(run: { modpackId: string; mods?: readonly string[] }): boolean {
  return selectedModIds(run.modpackId, run.mods).includes('unisex-dlc-classes')
}
