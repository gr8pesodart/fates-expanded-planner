import type { ClassOptionVM } from '../viewmodels/types'
import { Chip } from './Chip'
import { GrowthSpark } from './GrowthSpark'
import { SkillGem } from './SkillGem'
import { Sprite } from './Sprite'

export interface ClassCardProps {
  vm: ClassOptionVM
}

function bestIndex(values: number[]): number {
  let best = 0
  for (let i = 1; i < values.length; i += 1) if (values[i] > values[best]) best = i
  return best
}

export function ClassCard({ vm }: ClassCardProps) {
  return (
    <article
      className={['classcard', vm.selected ? 'sel' : '', vm.compareState === 'a' ? 'cmpl-a' : '', vm.compareState === 'b' ? 'cmpl-b' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <button type="button" className="classmain" onClick={vm.onSelect} aria-pressed={vm.selected}>
        <Sprite label={vm.name} src={vm.sprite.src} size="sm" />
        <span className="unitbody">
          <span className="classname">
            <b>{vm.name}</b>
            <Chip>{vm.tierLabel}</Chip>
            {vm.dlc ? <Chip variant="accent">DLC</Chip> : null}
          </span>
          <span className="classgrowth">
            <GrowthSpark values={vm.growths} best={bestIndex(vm.growths)} label={`${vm.name} total growths`} />
            <span className="num growthsum">Σ {vm.growthTotal}</span>
          </span>
        </span>
      </button>
      <div className="classfoot">
        <span className="classskills">
          {vm.skills.map((skill) => (
            <SkillGem key={skill.id} short={skill.short} name={skill.name} state="on" size="sm" />
          ))}
        </span>
        <button
          type="button"
          className="chipbtn"
          aria-pressed={vm.compareState !== 'none'}
          aria-label={`Compare ${vm.name}`}
          onClick={vm.onCompare}
        >
          <Chip variant={vm.compareState !== 'none' ? 'accent' : 'plain'}>⇄ Compare</Chip>
        </button>
      </div>
    </article>
  )
}
