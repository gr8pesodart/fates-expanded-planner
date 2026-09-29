import { BottomSheet } from '../components/BottomSheet'
import { Chip, ChipButton } from '../components/Chip'
import { ClassCard } from '../components/ClassCard'
import { Hanko } from '../components/Hanko'
import { PartnerOptionRow } from '../components/PartnerOptionRow'
import { SkillGem } from '../components/SkillGem'
import { SkillOptionRow } from '../components/SkillOptionRow'
import { Sprite } from '../components/Sprite'
import { StatBars } from '../components/StatBars'
import { WarningCard } from '../components/WarningCard'
import { useUnitVM } from '../viewmodels/useUnitVM'
import type { RelationshipChipVM } from '../viewmodels/types'

function RelationshipChip({ chip }: { chip: RelationshipChipVM }) {
  const content = (
    <>
      {chip.rank ? <Hanko rank={chip.rank} size="sm" /> : null}
      <span className="relchip-label">{chip.label}</span>
      <span className="relchip-value">{chip.value}</span>
      {chip.onOpen ? <span aria-hidden="true">▾</span> : null}
    </>
  )
  if (!chip.onOpen) {
    return <span className={['chip', chip.tone === 'accent' ? 'accent' : ''].filter(Boolean).join(' ')}>{content}</span>
  }
  return (
    <button type="button" className="chipbtn" onClick={chip.onOpen} aria-label={`${chip.label}: ${chip.value}`}>
      <span className={['chip', chip.tone === 'accent' ? 'accent' : ''].filter(Boolean).join(' ')}>{content}</span>
    </button>
  )
}

export function UnitScreen({ unitId }: { unitId: string }) {
  const vm = useUnitVM(unitId)
  const filled = vm.skills.slots.filter((slot) => slot.skill).length

  return (
    <section className="unitscreen" data-testid={`unit-${vm.id}`}>
      <header className="card unithead">
        <button type="button" className="btn ghost backbtn" onClick={vm.onBack} aria-label="Back to roster">
          ←
        </button>
        <Sprite label={vm.name} src={vm.sprite.src} tone={vm.sprite.tone} size="lg" />
        <div className="unitheadtext">
          <h2>{vm.name}</h2>
          <span className="muted">
            {vm.className} · <span className="num">{vm.levelLabel}</span>
          </span>
        </div>
        <button type="button" className="btn ghost" onClick={vm.onOpenRoute}>
          Class route →
        </button>
      </header>

      <div className="scroller relstrip">
        {vm.relationships.map((chip) => (
          <RelationshipChip key={chip.id} chip={chip} />
        ))}
      </div>

      {vm.warnings.map((warning) => (
        <WarningCard key={warning.id} warning={warning} />
      ))}

      <section className="card statspanel">
        <header className="cardhead">
          <h3>Growths &amp; caps</h3>
          <div className="scroller">
            {vm.stats.levels.map((level) => (
              <ChipButton key={level} active={level === vm.stats.level} variant="accent" onClick={() => vm.stats.onSetLevel(level)}>
                Lv {level} avg
              </ChipButton>
            ))}
          </div>
        </header>
        <StatBars rows={vm.stats.rows} />
        <div className="legend">
          <span>
            <i className="sw-ink" /> personal growth
          </span>
          <span>
            <i className="sw-accent" /> class growth
          </span>
          <span>
            <span className="delta">+n</span> pair-up from partner
          </span>
        </div>
        {vm.stats.partnerNote ? <p className="muted smallnum">{vm.stats.partnerNote}</p> : null}
      </section>

      {vm.classGroups.map((group) => (
        <section className="classgroup" key={group.id}>
          <h3 className="sectiontitle">
            {group.label}
            {group.note ? <span className="muted note"> {group.note}</span> : null}
          </h3>
          <div className="classgrid">
            {group.options.map((option) => (
              <ClassCard key={option.key} vm={option} />
            ))}
          </div>
        </section>
      ))}

      {vm.compare ? (
        <section className="card comparepanel" data-testid="class-compare">
          <header className="cardhead">
            <h3>Compare classes</h3>
            <button type="button" className="linkish" onClick={vm.compare.onClear}>
              Clear
            </button>
          </header>
          <div className="cmp cmp2">
            <span />
            {vm.compare.columns.map((column) => (
              <span className="h" key={column.classId}>
                <Sprite label={column.name} src={column.sprite.src} size="sm" />
                {column.name}
              </span>
            ))}
            {vm.compare.rows.map((row) => (
              <span className="cmprow" key={row.label}>
                <span className="k">{row.label}</span>
                {row.values.map((value, index) => (
                  <span key={index} className={row.bestIndex === index ? 'best' : undefined}>
                    {value}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card skillspanel">
        <header className="cardhead">
          <h3>
            Skills <span className="muted">· {filled} / 5</span>
          </h3>
        </header>
        <div className="skillslots">
          {vm.skills.slots.map((slot) => (
            <SkillGem
              key={slot.slot}
              state={slot.skill ? 'on' : 'empty'}
              short={slot.skill?.short}
              name={slot.skill ? `${slot.skill.name} — tap to replace` : `Empty slot ${slot.slot + 1}`}
              onClick={slot.onOpen}
            />
          ))}
        </div>
        <p className="muted smallnum">
          Personal: <b className="ink">{vm.skills.personal.name}</b> · tap a slot to browse the pool with
          learn-level tags.
        </p>
      </section>

      {vm.inheritance ? (
        <section className="card inherit" data-testid="inheritance">
          <h3>Inheritance</h3>
          <div className="parents">
            {[vm.inheritance.fixedParent, vm.inheritance.variableParent].map((parent, index) => (
              <div className="parentrow" key={index}>
                <Sprite label={parent.name} src={parent.sprite.src} tone={parent.sprite.tone} size="sm" />
                <b>{parent.name}</b>
                {parent.skill ? (
                  <>
                    <SkillGem short={parent.skill.short} name={parent.skill.name} state="on" size="sm" />
                    <span>{parent.skill.name}</span>
                  </>
                ) : (
                  <span className="muted">no skill equipped yet</span>
                )}
              </div>
            ))}
          </div>
          <p className="muted smallnum">Branches: {vm.inheritance.branches.join(' · ')}</p>
          <p className="muted smallnum">{vm.inheritance.rule}</p>
        </section>
      ) : null}

      <section className="card combat" data-testid="combat-pairup">
        <header className="cardhead">
          <h3>Combat pair-up</h3>
          <Chip>pair-up deltas show on the stats above</Chip>
        </header>
        <div className="combatrow">
          <div className="seg" role="group" aria-label="Combat role">
            <button type="button" aria-pressed={vm.combat.role === 'front'} onClick={() => vm.combat.onSetRole('front')}>
              Front
            </button>
            <button type="button" aria-pressed={vm.combat.role === 'back'} onClick={() => vm.combat.onSetRole('back')}>
              Back
            </button>
          </div>
          <button type="button" className="chipbtn" onClick={vm.combat.onOpenPartnerPicker}>
            <Chip variant="accent">{vm.combat.partnerName ? `w/ ${vm.combat.partnerName} ▾` : 'Pick partner ▾'}</Chip>
          </button>
        </div>
      </section>

      <BottomSheet
        open={Boolean(vm.skillPicker)}
        title={`Skill slot ${(vm.skillPicker?.slot ?? 0) + 1}`}
        subtitle="Pool from every class branch · learn-level tags"
        onClose={vm.skillPicker?.onClose ?? (() => undefined)}
        testId="skill-sheet"
      >
        {vm.skillPicker ? (
          <div className="optionlist">
            <button type="button" className="linkish" onClick={vm.skillPicker.onClearSlot}>
              Clear this slot
            </button>
            {vm.skillPicker.groups.map((group) => (
              <div className="optiongroup" key={group.id}>
                <p className="group-h">{group.label}</p>
                {group.options.map((option) => (
                  <SkillOptionRow key={`${group.id}-${option.id}`} vm={option} />
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={Boolean(vm.partnerSheet)}
        title={
          vm.partnerSheet?.rank === 'S' ? 'S partner' : vm.partnerSheet?.rank === 'A+' ? 'A+ partner' : 'Variable parent'
        }
        subtitle={vm.partnerSheet ? `${vm.partnerSheet.unitName} · filtered by the installed support graph` : undefined}
        onClose={vm.partnerSheet?.onClose ?? (() => undefined)}
        testId="partner-sheet"
      >
        {vm.partnerSheet ? (
          <div className="optionlist">
            <button type="button" className="linkish" onClick={vm.partnerSheet.onClear}>
              Clear current selection
            </button>
            {vm.partnerSheet.options.map((option) => (
              <PartnerOptionRow key={option.id} vm={option} rank={vm.partnerSheet!.rank} />
            ))}
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={Boolean(vm.combatSheet)}
        title="Combat partner"
        subtitle="Who this unit leads or supports on the map"
        onClose={vm.combatSheet?.onClose ?? (() => undefined)}
        testId="combat-sheet"
      >
        {vm.combatSheet ? (
          <div className="optionlist">
            <button type="button" className="linkish" onClick={vm.combatSheet.onClear}>
              Clear partner
            </button>
            {vm.combatSheet.options.map((option) => (
              <button
                type="button"
                key={option.id}
                className={['rowitem', option.current ? 'current' : ''].filter(Boolean).join(' ')}
                onClick={option.onPick}
              >
                <Sprite label={option.name} src={option.sprite.src} tone={option.sprite.tone} size="sm" />
                <span className="rowbody">
                  <span className="rowname">{option.name}</span>
                </span>
                <span className="rowcheck" aria-hidden="true">
                  {option.current ? '✓' : ''}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </BottomSheet>
    </section>
  )
}
