import type { PairCardVM } from '../viewmodels/types'
import { Chip } from './Chip'
import { Hanko } from './Hanko'
import { Sprite } from './Sprite'

export function PairCard({ vm }: { vm: PairCardVM }) {
  return (
    <div className="card pair">
      <div className="couple">
        <div className="who">
          <button type="button" className="whobtn" onClick={vm.a.onOpen}>
            <Sprite label={vm.a.name} src={vm.a.sprite.src} tone={vm.a.sprite.tone} size="sm" />
            {vm.a.name}
          </button>
          <button type="button" className="chipbtn" aria-label={`Change ${vm.a.name}'s S partner`} onClick={vm.a.onOpenPartner}>
            <Chip>▾</Chip>
          </button>
        </div>
        <Hanko rank="S" />
        <div className="who">
          <button type="button" className="whobtn" onClick={vm.b.onOpen}>
            <Sprite label={vm.b.name} src={vm.b.sprite.src} tone={vm.b.sprite.tone} size="sm" />
            {vm.b.name}
          </button>
          <button type="button" className="chipbtn" aria-label={`Change ${vm.b.name}'s S partner`} onClick={vm.b.onOpenPartner}>
            <Chip>▾</Chip>
          </button>
        </div>
      </div>
      {vm.child ? (
        <button type="button" className="child" onClick={vm.child.onOpen} aria-label={`Open ${vm.child.name}`}>
          <Sprite label={vm.child.name} src={vm.child.sprite.src} tone={vm.child.sprite.tone} size="sm" />
          <span className="unitbody">
            <span>
              <b>{vm.child.name}</b> <span className="muted">· inherits {vm.child.inheritedClass}</span>
              {vm.child.conflict ? (
                <span className="chip warn" title={vm.child.conflict}>
                  !
                </span>
              ) : null}
            </span>
            <span className="num childgoods">{vm.child.growths.join(' ')}</span>
          </span>
        </button>
      ) : (
        <span className="muted childless">No child branch for this pair.</span>
      )}
    </div>
  )
}
