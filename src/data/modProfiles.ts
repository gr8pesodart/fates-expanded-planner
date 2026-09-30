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
  /** True when it changes gameplay; false for purely cosmetic/audio mods. */
  gameplay: boolean
  required?: boolean
  url?: string
}

export interface BuildFeatures {
  /** UGF's expanded support graph (same-sex S supports, extra conversations). */
  expandedSupports: boolean
  /** Every renown reward obtainable with 0 BP/VP. */
  freeRenown: boolean
  /** Tru's shop: full accessory catalog, all prices set to 0. */
  freeAccessories: boolean
  /** Unit Select Voice: per-unit voice choice at recruitment/creation. */
  voiceSelect: boolean
  /** Texture/model replacements bundled in the build. */
  cosmeticTextures: boolean
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
    freeRenown: true,
    freeAccessories: true,
    voiceSelect: true,
    cosmeticTextures: true,
  },
  mods: [
    {
      id: 'ugf',
      name: 'Unofficial Gay Fates',
      version: '2.5.2',
      effect:
        'Expands the support graph: same-sex S supports, new conversation sets, extra Corrin / child / sibling supports, adjusted support routes.',
      gameplay: true,
      required: true,
      url: 'https://gamebanana.com/mods/51420',
    },
    {
      id: 'free-renown',
      name: 'Free Renown Rewards',
      version: '1.0',
      effect: 'All 160 minimum BP/VP requirements zeroed — every renown reward is obtainable immediately.',
      gameplay: true,
      url: 'https://gamebanana.com/mods/472394',
    },
    {
      id: 'free-visit-rewards',
      name: 'Free battle and visitation rewards',
      version: '1.0',
      effect: 'Same GameData edit as Free Renown Rewards (verified identical values) — no grind for battle/visit rewards.',
      gameplay: true,
      url: 'https://gamebanana.com/mods/485063',
    },
    {
      id: 'accessory-shop',
      name: "Tru's Accessory Shop",
      version: 'v2',
      effect: 'Full accessory catalog sold in the shop; models/textures from Texture Compilation.',
      gameplay: true,
      url: 'https://gamebanana.com/mods/480913',
    },
    {
      id: 'free-accessory-prices',
      name: "Tru's Free Accessory Prices",
      version: 'addon',
      effect: 'AcceShop data replaced so accessories cost no meaningful gold.',
      gameplay: true,
      url: 'https://gamebanana.com/mods/480913',
    },
    {
      id: 'unit-select-voice',
      name: 'Unit Select Voice',
      version: '1.3.4',
      effect: 'Choose any voiced unit’s voice lines for a character; adds the missing Corrin voice strings.',
      gameplay: false,
      url: 'https://gamebanana.com/mods/51423',
    },
    {
      id: 'fates-icon-project',
      name: 'Fates Icon Project (regular)',
      version: '1.0',
      effect: 'Menu / skill / item icon replacements.',
      gameplay: false,
      url: 'https://gamebanana.com/mods/34160',
    },
    {
      id: 'texture-compilation',
      name: 'Fire Emblem Fates Texture Compilation',
      version: '6.7',
      effect: 'Large class/outfit texture pack (bundles the Gold faceless fix).',
      gameplay: false,
      url: 'https://gamebanana.com/mods/388979',
    },
    {
      id: 'furry-fates',
      name: 'Furry Fates',
      version: '2.2',
      effect: 'Model/texture swaps.',
      gameplay: false,
      url: 'https://gamebanana.com/mods/663124',
    },
    {
      id: 'dragon-hare-corrin',
      name: 'Dragon-Hare Corrin',
      version: '5.0',
      effect: 'Corrin model replacement (Male+Female variant installed).',
      gameplay: false,
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
    freeRenown: false,
    freeAccessories: false,
    voiceSelect: false,
    cosmeticTextures: false,
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
