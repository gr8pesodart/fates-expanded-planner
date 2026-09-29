import { Portrait } from './art'
import { Icon } from './icons'
import type { SlotKind } from './slots'
import { SLOT_LABEL } from './slots'


function Glyph({ kind }: { kind: SlotKind }) {
  if (kind === 'pair') return <Icon name="swords" size={14} />
  if (kind === 'parent') return <span className="slot-glyph">P</span>
  return <span className="slot-glyph">{kind === 's' ? 'S' : 'A+'}</span>
}

/** 28px roster slot: dashed placeholder in the slot hue, or the partner's face chip. */
export function RelationSlot({ kind, partner, onClick, ownerName, disabled }: {
  kind: SlotKind
  partner: { id: string; name: string } | null
  onClick(): void
  ownerName: string
  disabled?: boolean
}) {
  const label = partner ? `${SLOT_LABEL[kind]} for ${ownerName}: ${partner.name}` : `Choose ${SLOT_LABEL[kind]} for ${ownerName}`
  return (
    <button type="button" className="rel-slot" data-kind={kind} data-filled={partner ? '' : undefined} aria-label={label} onClick={onClick} disabled={disabled}>
      {partner ? <Portrait unitId={partner.id} name={partner.name} /> : <Glyph kind={kind} />}
    </button>
  )
}

/** Profile relationship card: bust portrait with the name overlaid, or the empty glyph. */
export function RelationCard({ kind, partner, onClick, disabled }: {
  kind: SlotKind
  partner: { id: string; name: string } | null
  onClick(): void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="rel-card"
      data-kind={kind}
      data-filled={partner ? '' : undefined}
      aria-label={partner ? `${SLOT_LABEL[kind]}: ${partner.name}. Change` : `Choose ${SLOT_LABEL[kind]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {partner ? (
        <>
          <Portrait unitId={partner.id} name={partner.name} crop="bust" className="rel-card-art" />
          <span className="rel-card-name">{partner.name}</span>
        </>
      ) : (
        <span className="rel-card-empty"><Glyph kind={kind} /></span>
      )}
    </button>
  )
}
