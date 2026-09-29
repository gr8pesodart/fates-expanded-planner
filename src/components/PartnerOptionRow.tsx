import type { PartnerOptionVM } from '../viewmodels/types'
import { Chip } from './Chip'
import { Hanko } from './Hanko'
import { Sprite } from './Sprite'

export interface PartnerOptionRowProps {
  vm: PartnerOptionVM
  rank: 'S' | 'A+' | 'Parent'
}

export function PartnerOptionRow({ vm, rank }: PartnerOptionRowProps) {
  return (
    <button type="button" className={['rowitem', vm.current ? 'current' : ''].filter(Boolean).join(' ')} onClick={vm.onPick}>
      <Sprite label={vm.name} src={vm.sprite.src} tone={vm.sprite.tone} size="sm" />
      <span className="rowbody">
        <span className="rowname">
          {vm.name}
          {vm.current ? <Hanko rank={rank === 'Parent' ? '♥' : rank} size="sm" /> : null}
        </span>
        <span className="rowbadges">
          <Chip variant={vm.romantic ? 'accent' : 'plain'}>{vm.romantic ? 'romantic' : 'platonic'}</Chip>
          {vm.fast ? <Chip variant="warn">fast</Chip> : null}
          {vm.hasS ? <Chip>S-capable</Chip> : <Chip>locked</Chip>}
          {vm.hasA ? <Chip>A+</Chip> : null}
        </span>
      </span>
      <span className="rowcheck" aria-hidden="true">
        {vm.current ? '✓' : ''}
      </span>
    </button>
  )
}
