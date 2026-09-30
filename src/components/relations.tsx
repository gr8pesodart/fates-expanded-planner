import { Portrait } from './art'
import { Icon } from './icons'
import type { SlotKind } from './slots'
import { slotLabel } from './slots'


/** `corrin` swaps the A+ glyph for A: Corrin's A slot holds A-rank Friendship Seal partners. */
function Glyph({ kind, corrin = false }: { kind: SlotKind; corrin?: boolean }) {
  if (kind === 'pair') return <Icon name="swords" size={14} />
  if (kind === 'parent') return <span className="slot-glyph">P</span>
  return <span className="slot-glyph">{kind === 's' ? 'S' : corrin ? 'A' : 'A+'}</span>
}

/** 28px roster slot: dashed placeholder in the slot hue, or the partner's face chip. */
export function RelationSlot({ kind, partner, onClick, ownerName, disabled, corrin = false, more = 0 }: {
  kind: SlotKind
  partner: { id: string; name: string } | null
  onClick(): void
  ownerName: string
  disabled?: boolean
  corrin?: boolean
  /** Further partners beyond `partner` (Corrin's A slot holds several). */
  more?: number
}) {
  const slot = slotLabel(kind, corrin)
  const label = partner ? `${slot} for ${ownerName}: ${partner.name}${more ? ` and ${more} more` : ''}` : `Choose ${slot} for ${ownerName}`
  return (
    <button type="button" className="rel-slot" data-kind={kind} data-filled={partner ? '' : undefined} aria-label={label} onClick={onClick} disabled={disabled}>
      {partner ? <Portrait unitId={partner.id} name={partner.name} /> : <Glyph kind={kind} corrin={corrin} />}
      {partner && more ? <span className="rel-more" aria-hidden="true">+{more}</span> : null}
    </button>
  )
}

/** Profile relationship card: bust portrait with the name overlaid, or the empty glyph. */
export function RelationCard({ kind, partner, onClick, disabled, corrin = false, more = 0 }: {
  kind: SlotKind
  partner: { id: string; name: string } | null
  onClick(): void
  disabled?: boolean
  corrin?: boolean
  more?: number
}) {
  const slot = slotLabel(kind, corrin)
  return (
    <button
      type="button"
      className="rel-card"
      data-kind={kind}
      data-filled={partner ? '' : undefined}
      aria-label={partner ? `${slot}: ${partner.name}${more ? ` and ${more} more` : ''}. Change` : `Choose ${slot}`}
      onClick={onClick}
      disabled={disabled}
    >
      {partner ? (
        <>
          <Portrait unitId={partner.id} name={partner.name} crop="bust" className="rel-card-art" />
          <span className="rel-card-name">{partner.name}{more ? ` +${more}` : ''}</span>
        </>
      ) : (
        <span className="rel-card-empty"><Glyph kind={kind} corrin={corrin} /></span>
      )}
    </button>
  )
}
