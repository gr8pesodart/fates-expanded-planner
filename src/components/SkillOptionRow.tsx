import type { SkillOptionVM } from '../viewmodels/types'
import { Chip } from './Chip'
import { SkillGem } from './SkillGem'

export function SkillOptionRow({ vm }: { vm: SkillOptionVM }) {
  return (
    <div className={['rowitem', vm.equipped ? 'current' : '', vm.reached ? '' : 'locked'].filter(Boolean).join(' ')}>
      <button type="button" className="rowmain" onClick={vm.onPick} aria-label={`Equip ${vm.name}`}>
        <SkillGem short={vm.short} name={vm.name} state={vm.equipped ? 'on' : 'off'} />
        <span className="rowbody">
          <span className="rowname">{vm.name}</span>
          <span className="rowbadges">
            <Chip>{vm.source}</Chip>
            {vm.dlc ? <Chip variant="accent">DLC</Chip> : null}
            {vm.reached ? <Chip variant="accent">on route</Chip> : <Chip variant="warn">not reached</Chip>}
          </span>
        </span>
      </button>
      {!vm.reached && vm.onAddStop ? (
        <button type="button" className="linkish" onClick={vm.onAddStop}>
          Add stop
        </button>
      ) : null}
    </div>
  )
}
