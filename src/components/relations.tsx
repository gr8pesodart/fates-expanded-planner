import type { ReactNode } from 'react'
import type { UnitDef } from '../data/types'
import { usePlanner } from '../app/plannerContext'
import { displayName } from '../logic/army'
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

/**
 * Profile relationship card: bust portrait with the name overlaid, or the empty glyph. Corrin's A
 * slot can hold several partners: 2–4 share a 2×2 grid of busts, more use a larger grid of face
 * crops (Figma 14:352); spare cells take the slot hue.
 */
export function RelationCard({ kind, partners, onClick, disabled, corrin = false, stale = false }: {
  kind: SlotKind
  partners: readonly { id: string; name: string }[]
  onClick(): void
  disabled?: boolean
  corrin?: boolean
  /** The stored partner moved on while the other Corrin was active: shown greyed, grants nothing. */
  stale?: boolean
}) {
  const slot = slotLabel(kind, corrin)
  const [first] = partners
  const columns = partners.length > 1 ? Math.ceil(Math.sqrt(partners.length)) : 1
  const names = partners.map((partner) => partner.name).join(', ')
  return (
    <button
      type="button"
      className="rel-card"
      data-kind={kind}
      data-filled={first ? '' : undefined}
      data-grid={columns > 1 ? '' : undefined}
      data-stale={stale ? '' : undefined}
      aria-label={first ? `${slot}: ${names}. Change` : `Choose ${slot}`}
      onClick={onClick}
      disabled={disabled}
    >
      {!first ? (
        <span className="rel-card-empty"><Glyph kind={kind} corrin={corrin} /></span>
      ) : columns === 1 ? (
        <>
          <Portrait unitId={first.id} name={first.name} crop="bust" className="rel-card-art" />
          <span className="rel-card-name">{first.name}</span>
        </>
      ) : (
        <span className="rel-card-grid" style={{ gridTemplate: `repeat(${columns}, minmax(0, 1fr)) / repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns * columns }, (_, index) => {
            const partner = partners[index]
            return partner
              ? <Portrait key={partner.id} unitId={partner.id} name={partner.name} crop={columns > 2 ? 'face' : 'bust'} className="rel-card-cell" />
              : <span key={`spare-${index}`} className="rel-card-cell spare" />
          })}
        </span>
      )}
    </button>
  )
}

/** A tappable row that opens another character's page (family quick links, Parent A). */
export function UnitLink({ unit, onOpen, children }: { unit: UnitDef; onOpen(): void; children?: ReactNode }) {
  const { run } = usePlanner()
  const name = displayName(unit, run)
  return (
    <button type="button" className="unit-link" aria-label={`Open ${name}`} onClick={onOpen}>
      <Portrait unitId={unit.id} name={name} className="chip-32" />
      <span className="unit-link-name">{name}</span>
      {children}
      <span className="edit-btn unit-link-go" aria-hidden="true"><Icon name="arrowRight" size={20} /></span>
    </button>
  )
}
