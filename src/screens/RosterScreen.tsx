import { Fragment, memo, useMemo, useRef } from 'react'
import { usePickers } from '../app/pickerStore'
import { usePlanner } from '../app/plannerContext'
import { useUi } from '../app/ui'
import type { RosterEntry } from '../app/selectors'
import { useSortedRoster } from '../app/selectors'
import { ClassSprite, Portrait } from '../components/art'
import { preloadCutinArt } from '../data/art'
import { EditButton, Rail, StarButton } from '../components/controls'
import { SortIcon } from '../components/SortIcon'
import type { SlotKind } from '../components/slots'
import { RelationSlot } from '../components/relations'
import { StatTable } from '../components/StatTable'
import type { StatSlide, StatTableProps } from '../components/StatTable'
import { SwapButton } from '../components/SwapButton'
import { displayName } from '../logic/army'
import { lensDef, lensRow, LENSES } from '../logic/lenses'
import { expectedFinal } from '../logic/progression'
import { toggleFavourite } from '../logic/relationships'
import { navigate } from '../lib/router'
import { useSwipePager } from '../lib/swipe'

const SORT_LABEL = { recruit: 'Recruit order', name: 'Name', stat: 'Stat' } as const

export function RosterScreen({ activeUnitId }: { activeUnitId?: string }) {
  const { rosterLens, rosterSort, rosterFavouritesFirst, rosterLinkPairs, rosterGeneration, setRosterLens } = useUi()
  const { dataset, run } = usePlanner()
  const { entries, sort } = useSortedRoster(rosterLens, rosterSort, { favouritesFirst: rosterFavouritesFirst, linkPairs: rosterLinkPairs, generation: rosterGeneration })
  const openPicker = usePickers((state) => state.open)
  const lens = lensDef(rosterLens)
  const lensIndex = LENSES.findIndex((item) => item.id === rosterLens)
  const listRef = useRef<HTMLUListElement | null>(null)
  useSwipePager(listRef, lensIndex, LENSES.length, (next) => setRosterLens(LENSES[next].id), { targets: '.stat-strip-track' })
  // The neighbouring lenses' tables, pre-rendered either side so a swipe shows them mid-drag.
  const neighbours = useMemo(() => {
    const side = (index: number) => {
      const def = LENSES[index]
      if (!def) return null
      const cells = new Map(entries.map((entry) => {
        const final = def.id === 'expectedFinal' ? expectedFinal(dataset, run, entry.ctx) : null
        return [entry.unitId, { row: final ? final.row : lensRow(dataset, run, entry.ctx, def.id), muted: final?.base ?? false }]
      }))
      const referenceRows = [...cells.values()].map((cell) => cell.row)
      return (unitId: string): StatTableProps | undefined => {
        const cell = cells.get(unitId)
        return cell ? { ...cell, signed: def.signed, referenceRows } : undefined
      }
    }
    return { prev: side(lensIndex - 1), next: side(lensIndex + 1) }
  }, [entries, lensIndex, dataset, run])
  const referenceRows = entries.map((item) => item.lensRow)
  return (
    <section className="screen roster" aria-labelledby="roster-title">
      <div className="roster-sticky-head">
        <div className="screen-head">
          <h1 id="roster-title" className="screen-title">Roster</h1>
          <button type="button" className="icon-btn sort-btn" aria-label={`Sort: ${SORT_LABEL[sort.kind]}. Change sort`} onClick={() => openPicker({ sort: 'roster' })}>
            <SortIcon sort={sort} size={34} />
          </button>
        </div>
        <Rail
          variant="tabs"
          label="Stats shown"
          items={LENSES.map((item) => ({ id: item.id, label: item.label }))}
          active={rosterLens}
          onSelect={setRosterLens}
        />
      </div>
      <ul ref={listRef} className="roster-list" data-swipe>
        {entries.map((entry, index) => {
          const next = entries[index + 1]
          const swap = rosterLinkPairs && entry.pairRole !== 'back' && entry.pairPartner !== undefined && next && next.unitId === entry.pairPartner
            ? { unitId: entry.pairPartner, name: next.name }
            : null
          return (
            <Fragment key={entry.unitId}>
              <RosterRow
                entry={entry}
                signed={lens.signed}
                slide={{ index: lensIndex, prev: neighbours.prev?.(entry.unitId), next: neighbours.next?.(entry.unitId) }}
                active={entry.unitId === activeUnitId}
                referenceRows={referenceRows}
              />
              {swap ? (
                <li className="roster-swap">
                  <SwapButton unitId={swap.unitId} frontName={entry.name} backName={swap.name} />
                </li>
              ) : null}
            </Fragment>
          )
        })}
      </ul>
    </section>
  )
}

const RosterRow = memo(function RosterRow({ entry, signed, slide, active, referenceRows }: { entry: RosterEntry; signed: boolean; slide: StatSlide; active: boolean; referenceRows: (number | null)[][] }) {
  const { dataset, run, readOnly, mutate } = usePlanner()
  const openPicker = usePickers((state) => state.open)
  const { ctx, name, unitId } = entry
  const classDef = dataset.classesById.get(ctx.currentClassId)
  const partner = (unit: typeof ctx.sPartner) => (unit ? { id: unit.id, name: displayName(unit, run) } : null)
  const slots: [SlotKind, ReturnType<typeof partner>][] = [
    ['s', partner(ctx.sPartner)],
    ['pair', partner(ctx.pairPartner)],
  ]
  // Corrin's A slot shows the first planned Friendship Seal partner (Corrin has no A+).
  slots.splice(1, 0, ['a', partner(ctx.unit.isCorrin ? ctx.friendshipPartners[0] : ctx.aPlusPartner)])
  const more = ctx.unit.isCorrin ? Math.max(0, ctx.friendshipPartners.length - 1) : 0
  if (ctx.isChild) slots.splice(2, 0, ['parent', partner(ctx.variableParent)])
  const open = () => navigate({ name: 'unit', unitId, tab: 'profile' })
  return (
    <li className="roster-row" aria-current={active || undefined} data-muted={entry.muted || undefined} onPointerEnter={() => preloadCutinArt(unitId)} onFocusCapture={() => preloadCutinArt(unitId)}>
      <div className="roster-row-top">
        <div className="roster-id">
          <Portrait unitId={unitId} name={name} className="chip-32" />
          <button type="button" className="sprite-btn" aria-label={`${classDef?.name ?? 'Class'} — choose ${name}'s class`} disabled={readOnly} onClick={() => openPicker({ classes: unitId })}>
            <ClassSprite unitId={unitId} classId={ctx.currentClassId} name={classDef?.name ?? 'Class'} size={32} />
          </button>
          <span className="unit-name">{name}</span>
          <StarButton heart on={entry.favourite} name={name} disabled={readOnly} onToggle={() => mutate((run) => toggleFavourite(run, unitId))} />
        </div>
        <div className="roster-actions">
          {slots.map(([kind, value]) => (
            <RelationSlot key={kind} kind={kind} partner={value} ownerName={name} corrin={ctx.unit.isCorrin} more={kind === 'a' ? more : 0} disabled={readOnly} onClick={() => openPicker({ character: { unitId, kind } })} />
          ))}
          <EditButton label={`Open ${name}`} onClick={open} />
        </div>
      </div>
      <StatTable row={entry.lensRow} signed={signed} muted={entry.muted} label={`${name} stats`} referenceRows={referenceRows} slide={slide} />
    </li>
  )
})
