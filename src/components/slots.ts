export type SlotKind = 's' | 'a' | 'pair' | 'parent'

export const SLOT_LABEL: Record<SlotKind, string> = { s: 'S Rank', a: 'A+ Rank', pair: 'Pair Up', parent: 'Parent B' }

/** Corrin can't hold an A+ rank; Corrin's A slot lists planned A-rank Friendship Seal partners. */
export function slotLabel(kind: SlotKind, isCorrin: boolean): string {
  return kind === 'a' && isCorrin ? 'A Rank' : SLOT_LABEL[kind]
}
