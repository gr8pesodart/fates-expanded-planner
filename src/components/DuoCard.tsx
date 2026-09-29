import type { DuoVM, PreviewSlotVM } from '../viewmodels/types'
import { Hanko } from './Hanko'
import { Sprite } from './Sprite'

export function PreviewSlotRow({ slot }: { slot: PreviewSlotVM }) {
  const strong = slot.facts.filter((fact) => !fact.soft)
  const soft = slot.facts.filter((fact) => fact.soft)
  return (
    <button type="button" className="slot" onClick={slot.onOpen} aria-label={`Open ${slot.name}`}>
      <span className="role">{slot.role}</span>
      <Sprite label={slot.name} src={slot.sprite.src} tone={slot.sprite.tone} size="sm" />
      <span className="slotbody">
        <span className="slotname">
          <b>{slot.name}</b>
          {slot.conflict ? (
            <span className="chip warn" title={slot.conflict}>
              !
            </span>
          ) : null}
        </span>
        <span className="facts">
          {strong.map((fact, index) => (
            <span key={`${fact.label}-${index}`}>
              <strong>{fact.label}</strong> {fact.value}
            </span>
          ))}
        </span>
        {soft.map((fact, index) => (
          <span className="soft" key={`soft-${index}`}>
            {fact.value}
          </span>
        ))}
      </span>
      {slot.hanko ? <Hanko rank={slot.hanko} size="sm" /> : <span />}
    </button>
  )
}

export function DuoCard({ vm }: { vm: DuoVM }) {
  return (
    <div className="duo" data-testid={`duo-${vm.front.id}`}>
      <PreviewSlotRow slot={vm.front} />
      <PreviewSlotRow slot={vm.back} />
    </div>
  )
}
