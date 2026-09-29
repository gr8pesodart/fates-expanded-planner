import { memo } from 'react'
import { sortIcon, usePickers } from '../app/pickerStore'
import { usePlanner } from '../app/plannerContext'
import { useUi } from '../app/ui'
import type { RosterEntry } from '../app/selectors'
import { useSortedRoster } from '../app/selectors'
import { ClassSprite, Portrait } from '../components/art'
import { EditButton, Rail, StarButton } from '../components/controls'
import { Icon } from '../components/icons'
import type { SlotKind } from '../components/slots'
import { RelationSlot } from '../components/relations'
import { StatTable } from '../components/StatTable'
import { displayName } from '../logic/army'
import { lensDef, LENSES } from '../logic/lenses'
import { toggleFavourite } from '../logic/relationships'
import { navigate } from '../lib/router'

const SORT_LABEL = { recruit: 'Recruit order', name: 'Name', stat: 'Stat' } as const

export function RosterScreen({ activeUnitId }: { activeUnitId?: string }) {
  const { rosterLens, rosterSort, setRosterLens } = useUi()
  const { entries, sort } = useSortedRoster(rosterLens, rosterSort)
  const openPicker = usePickers((state) => state.open)
  const lens = lensDef(rosterLens)
  return (
    <section className="screen roster" aria-labelledby="roster-title">
      <div className="screen-head">
        <h1 id="roster-title" className="screen-title">Roster</h1>
        <button type="button" className="icon-btn sort-btn" aria-label={`Sort: ${SORT_LABEL[sort.kind]}. Change sort`} onClick={() => openPicker({ sort: true })}>
          <Icon name={sortIcon(sort)} size={34} />
        </button>
      </div>
      <Rail
        variant="tabs"
        label="Stats shown"
        items={LENSES.map((item) => ({ id: item.id, label: item.label }))}
        active={rosterLens}
        onSelect={setRosterLens}
      />
      <ul className="roster-list">
        {entries.map((entry) => (
          <RosterRow key={entry.unitId} entry={entry} signed={lens.signed} active={entry.unitId === activeUnitId} />
        ))}
      </ul>
    </section>
  )
}

const RosterRow = memo(function RosterRow({ entry, signed, active }: { entry: RosterEntry; signed: boolean; active: boolean }) {
  const { dataset, readOnly, mutate } = usePlanner()
  const openPicker = usePickers((state) => state.open)
  const { ctx, name, unitId } = entry
  const classDef = dataset.classesById.get(ctx.currentClassId)
  const partner = (unit: typeof ctx.sPartner) => (unit ? { id: unit.id, name: displayName(unit) } : null)
  const slots: [SlotKind, ReturnType<typeof partner>][] = [
    ['s', partner(ctx.sPartner)],
    ['a', partner(ctx.aPlusPartner)],
    ['pair', partner(ctx.pairPartner)],
  ]
  if (ctx.isChild) slots.splice(2, 0, ['parent', partner(ctx.variableParent)])
  const open = () => navigate({ name: 'unit', unitId, tab: 'profile' })
  return (
    <li className="roster-row" aria-current={active || undefined}>
      <div className="roster-row-top">
        <div className="roster-id">
          <Portrait unitId={unitId} name={name} className="chip-32" />
          <span className="unit-name">{name}</span>
          <StarButton on={entry.favourite} name={name} disabled={readOnly} onToggle={() => mutate((run) => toggleFavourite(run, unitId))} />
        </div>
        <div className="roster-actions">
          <button type="button" className="sprite-btn" aria-label={`${classDef?.name ?? 'Class'} — choose ${name}'s class`} disabled={readOnly} onClick={() => openPicker({ classes: unitId })}>
            <ClassSprite unitId={unitId} classId={ctx.currentClassId} name={classDef?.name ?? 'Class'} size={28} tile />
          </button>
          {slots.map(([kind, value]) => (
            <RelationSlot key={kind} kind={kind} partner={value} ownerName={name} disabled={readOnly} onClick={() => openPicker({ character: { unitId, kind } })} />
          ))}
          <EditButton label={`Open ${name}`} onClick={open} />
        </div>
      </div>
      <StatTable row={entry.lensRow} signed={signed} label={`${name} stats`} />
    </li>
  )
})
