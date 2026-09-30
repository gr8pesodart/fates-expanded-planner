import { create } from 'zustand'
import type { SlotKind } from '../components/slots'
import type { Dataset } from '../data/types'
import { setBond, setVariableParent } from '../logic/relationships'
import type { RunPlan } from '../state/model'

/** An equip slot, or a child's inherited skill from the fixed / variable parent. */
export type SkillTarget = number | 'inheritFixed' | 'inheritVariable'

interface PickerState {
  character: { unitId: string; kind: SlotKind } | null
  classes: string | null
  skill: { unitId: string; slot: SkillTarget } | null
  sort: 'roster' | 'chart' | false
  open(next: Partial<Omit<PickerState, 'open' | 'close'>>): void
  close(): void
}

export const usePickers = create<PickerState>((set) => ({
  character: null,
  classes: null,
  skill: null,
  sort: false,
  open: (next) => set({ character: null, classes: null, skill: null, sort: false, ...next }),
  close: () => set({ character: null, classes: null, skill: null, sort: false }),
}))

export function bondOf(kind: SlotKind): 'sPartner' | 'aPlusPartner' | 'pairPartner' {
  return kind === 'a' ? 'aPlusPartner' : kind === 'pair' ? 'pairPartner' : 'sPartner'
}

export function applyBond(dataset: Dataset, run: RunPlan, unitId: string, kind: SlotKind, partnerId: string | null): RunPlan {
  return kind === 'parent' ? setVariableParent(dataset, run, unitId, partnerId) : setBond(run, unitId, bondOf(kind), partnerId)
}

