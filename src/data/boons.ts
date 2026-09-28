import type { StatKey } from './types'

/**
 * Avatar boon/bane effects (Fates). Growths are percentage-point additions,
 * cap mods apply to the seven non-HP stats (HP caps never take a modifier).
 */
export interface BoonBane {
  label: string
  growths: Record<StatKey, number>
  capMods: Partial<Record<StatKey, number>>
}

export const BOONS: Record<StatKey, BoonBane> = {
  hp: {
    label: 'Robust',
    growths: { hp: 15, str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 5, res: 5 },
    capMods: { str: 1, mag: 1, lck: 2, def: 2, res: 2 },
  },
  str: {
    label: 'Strong',
    growths: { hp: 0, str: 15, mag: 0, skl: 5, spd: 0, lck: 0, def: 5, res: 0 },
    capMods: { str: 4, skl: 2, def: 2 },
  },
  mag: {
    label: 'Clever',
    growths: { hp: 0, str: 0, mag: 20, skl: 0, spd: 5, lck: 0, def: 0, res: 5 },
    capMods: { mag: 4, spd: 2, res: 2 },
  },
  skl: {
    label: 'Deft',
    growths: { hp: 0, str: 5, mag: 0, skl: 25, spd: 0, lck: 0, def: 5, res: 0 },
    capMods: { str: 2, skl: 4, def: 2 },
  },
  spd: {
    label: 'Quick',
    growths: { hp: 0, str: 0, mag: 0, skl: 5, spd: 15, lck: 5, def: 0, res: 0 },
    capMods: { skl: 2, spd: 4, lck: 2 },
  },
  lck: {
    label: 'Lucky',
    growths: { hp: 0, str: 5, mag: 5, skl: 0, spd: 0, lck: 25, def: 0, res: 0 },
    capMods: { str: 2, mag: 2, lck: 4 },
  },
  def: {
    label: 'Sturdy',
    growths: { hp: 0, str: 0, mag: 0, skl: 0, spd: 0, lck: 5, def: 10, res: 5 },
    capMods: { lck: 2, def: 4, res: 2 },
  },
  res: {
    label: 'Calm',
    growths: { hp: 0, str: 0, mag: 5, skl: 0, spd: 5, lck: 0, def: 0, res: 10 },
    capMods: { mag: 2, spd: 2, res: 4 },
  },
}

export const BANES: Record<StatKey, BoonBane> = {
  hp: {
    label: 'Sickly',
    growths: { hp: -10, str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: -5, res: -5 },
    capMods: { str: -1, mag: -1, lck: -1, def: -1, res: -1 },
  },
  str: {
    label: 'Weak',
    growths: { hp: 0, str: -10, mag: 0, skl: -5, spd: 0, lck: 0, def: -5, res: 0 },
    capMods: { str: -3, skl: -1, def: -1 },
  },
  mag: {
    label: 'Dull',
    growths: { hp: 0, str: 0, mag: -15, skl: 0, spd: -5, lck: 0, def: 0, res: -5 },
    capMods: { mag: -3, spd: -1, res: -1 },
  },
  skl: {
    label: 'Clumsy',
    growths: { hp: 0, str: -5, mag: 0, skl: -20, spd: 0, lck: 0, def: -5, res: 0 },
    capMods: { str: -1, skl: -3, def: -1 },
  },
  spd: {
    label: 'Slow',
    growths: { hp: 0, str: 0, mag: 0, skl: -5, spd: -10, lck: -5, def: 0, res: 0 },
    capMods: { skl: -1, spd: -3, lck: -1 },
  },
  lck: {
    label: 'Unlucky',
    growths: { hp: 0, str: -5, mag: -5, skl: 0, spd: 0, lck: -20, def: 0, res: 0 },
    capMods: { str: -1, mag: -1, lck: -3 },
  },
  def: {
    label: 'Fragile',
    growths: { hp: 0, str: 0, mag: 0, skl: 0, spd: 0, lck: -5, def: -10, res: -5 },
    capMods: { lck: -1, def: -3, res: -1 },
  },
  res: {
    label: 'Excitable',
    growths: { hp: 0, str: 0, mag: -5, skl: 0, spd: -5, lck: 0, def: 0, res: -10 },
    capMods: { mag: -1, spd: -1, res: -3 },
  },
}

export const NO_BOON: BoonBane = {
  label: '—',
  growths: { hp: 0, str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 },
  capMods: {},
}
