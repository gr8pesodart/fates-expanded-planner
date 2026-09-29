import type { UnitSummaryVM } from '../viewmodels/types'
import { CapPips } from './CapPips'
import { GrowthSpark } from './GrowthSpark'
import { Hanko } from './Hanko'
import { Sprite } from './Sprite'

export interface UnitRowProps {
  vm: UnitSummaryVM
  compact?: boolean
  active?: boolean
}

export function UnitRow({ vm, compact = false, active = false }: UnitRowProps) {
  return (
    <div className={['unit', compact ? 'compact' : '', vm.pinned ? 'pinned' : '', active ? 'active' : ''].filter(Boolean).join(' ')}>
      <button type="button" className="unitmain" onClick={vm.onOpen} aria-label={`Open ${vm.name}`}>
        <Sprite label={vm.name} src={vm.sprite.src} tone={vm.sprite.tone} size={compact ? 'sm' : 'md'} />
        <span className="unitbody">
          <span className="unitname">
            {vm.name}
            {vm.rank ? <Hanko rank={vm.rank} size="sm" /> : null}
            {vm.conflict ? (
              <span className="chip warn" title={vm.conflict}>
                !
              </span>
            ) : null}
          </span>
          {compact ? null : (
            <span className="sub">
              {vm.classChips.map((chip) => (
                <span className="chip" key={chip}>
                  {chip}
                </span>
              ))}
              <span className="chip personal" title="Personal skill">
                {vm.personalSkill}
              </span>
            </span>
          )}
        </span>
        {compact ? null : (
          <span className="right">
            <GrowthSpark values={vm.growths} best={vm.bestStatIndex} label={`${vm.name} growths`} />
            <CapPips mods={vm.capMods} />
          </span>
        )}
      </button>
      <button
        type="button"
        className="pinbtn"
        aria-pressed={vm.pinned}
        aria-label={vm.pinned ? `Unpin ${vm.name}` : `Pin ${vm.name} to compare`}
        onClick={vm.onTogglePin}
      >
        {vm.pinned ? '●' : '○'}
      </button>
    </div>
  )
}
