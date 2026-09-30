import { useState } from 'react'
import { ClassSprite, Portrait } from '../components/art'
import { Icon } from '../components/icons'
import type { SlotKind } from '../components/slots'
import { SLOT_LABEL } from '../components/slots'
import { Sheet } from '../components/Sheet'
import { Segmented } from '../components/controls'
import { SortIcon } from '../components/SortIcon'
import { SkillCard } from '../components/SkillCard'
import { STAT_TABLE_KEYS, STAT_TABLE_LABELS } from '../data/types'
import { displayName, unitContext } from '../logic/army'
import { classFamily } from '../logic/classes'
import { blankColumns } from '../logic/lenses'
import type { ClassPoolEntry } from '../logic/classes'
import { buildProgression, dlcClassesFor } from '../logic/progression'
import type { RosterSort } from '../logic/rosterSort'
import { directionOfSort } from '../logic/rosterSort'
import { inheritableSkillPool, skillPool } from '../logic/skills'
import { SKILL_SLOTS, emptyUnitPlan } from '../state/model'
import { applyBond, bondOf, usePickers } from './pickerStore'
import type { SkillTarget } from './pickerStore'
import { usePlanner } from './plannerContext'
import { useUi } from './ui'
import { candidatesFor } from './selectors'

export function Pickers() {
  const { character, classes, skill, sort, close } = usePickers()
  if (character) return <CharacterPicker {...character} onClose={close} />
  if (classes) return <ClassPicker unitId={classes} onClose={close} />
  if (skill) return <SkillPicker {...skill} onClose={close} />
  if (sort) return <SortSheet target={sort} onClose={close} />
  return null
}

function CharacterPicker({ unitId, kind, onClose }: { unitId: string; kind: SlotKind; onClose(): void }) {
  const { dataset, run, mutate } = usePlanner()
  const [query, setQuery] = useState('')
  const owner = dataset.unitsById.get(unitId)
  const candidates = candidatesFor(dataset, run, unitId, kind)
  if (!owner) return null
  const ownerName = displayName(owner)
  const subjectId = kind === 'parent' ? owner.fixedParent : unitId
  const current = subjectId ? run.units[subjectId]?.[bondOf(kind)] : undefined
  const pick = (partnerId: string | null) => {
    mutate((next) => applyBond(dataset, next, unitId, kind, partnerId))
    onClose()
  }
  const shown = candidates.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <Sheet
      title={`${SLOT_LABEL[kind]} for ${ownerName}`}
      onClose={onClose}
      wide
      actions={current ? <button type="button" className="text-btn" onClick={() => pick(null)}>Clear</button> : null}
    >
      <label className="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search characters" />
      </label>
      {shown.length === 0 ? <p className="empty-note">No one in this build can take this slot{query ? ' with that name' : ''}.</p> : null}
      <div className="pick-grid">
        {shown.map((item) => (
          <button
            key={item.unit.id}
            type="button"
            className="pick-card"
            aria-pressed={item.unit.id === current}
            onClick={() => pick(item.unit.id)}
          >
            <Portrait unitId={item.unit.id} name={item.name} crop="bust" className="pick-art" />
            <span className="pick-name">{item.name}</span>
            {item.gains ? <span className="pick-gains">Gains {item.gains}</span> : null}
            <span className="pick-badges">
              {item.rankBadge ? <span className="badge rank-badge">{item.rankBadge} rank</span> : null}
              {item.fast ? <span className="badge">Fast</span> : null}
              {item.takenBy ? <span className="badge muted">w/ {item.takenBy}</span> : null}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

const BRANCH_ORDER: ClassPoolEntry['branch'][] = ['own', 'parent', 'seal', 'aplus']

function ClassPicker({ unitId, onClose }: { unitId: string; onClose(): void }) {
  const { dataset, run, mutate } = usePlanner()
  const ctx = unitContext(dataset, run, unitId)
  if (!ctx) return null
  const groups = new Map<string, number[]>()
  for (const branch of BRANCH_ORDER) {
    for (const entry of ctx.pool.filter((item) => item.branch === branch)) {
      const label = entry.sourceLabel.startsWith('Parent') ? 'Parent' : entry.sourceLabel.split(':')[0]
      const list = groups.get(label) ?? []
      if (!list.includes(entry.classId)) list.push(entry.classId)
      groups.set(label, list)
    }
  }
  if (run.dlc) groups.set('DLC', dlcClassesFor(dataset, ctx.unit.gender).map((def) => def.id))
  const name = displayName(ctx.unit)
  const choose = (classId: number) => {
    mutate((next) => ({ ...next, units: { ...next.units, [unitId]: { ...(next.units[unitId] ?? emptyUnitPlan()), classId } } }))
    onClose()
  }
  return (
    <Sheet title={`Classes for ${name}`} onClose={onClose}>
      {[...groups.entries()].map(([label, ids]) => (
        <section key={label} className="pick-group">
          <h3 className="sub-title muted">{label}</h3>
          {ids.map((classId) => {
            const def = dataset.classesById.get(classId)
            if (!def) return null
            const active = classId === ctx.currentClassId
            return (
              <button key={classId} type="button" className="class-row" aria-pressed={active} onClick={() => choose(classId)}>
                <ClassSprite unitId={unitId} classId={classId} name={def.name} size={32} tile />
                <span className="class-row-name">{classFamily(def.name)}</span>
                <span className="class-row-tier muted">{def.tier === 'promoted' ? 'Advanced' : def.tier === 'special' ? 'Special' : 'Base'}</span>
                {active ? <Icon name="check" size={20} className="accent" /> : null}
              </button>
            )
          })}
        </section>
      ))}
    </Sheet>
  )
}

function SkillPicker({ unitId, slot, onClose }: { unitId: string; slot: SkillTarget; onClose(): void }) {
  const { dataset, run, mutate } = usePlanner()
  const ctx = unitContext(dataset, run, unitId)
  if (!ctx) return null
  const name = displayName(ctx.unit)
  const plan = run.units[unitId] ?? emptyUnitPlan()
  const fixedParent = ctx.unit.fixedParent ? dataset.unitsById.get(ctx.unit.fixedParent) : undefined
  const inherit = slot === 'inheritFixed' || slot === 'inheritVariable'
  const field = slot === 'inheritFixed' ? 'inheritFixedSkill' : 'inheritSkill'
  const donor = slot === 'inheritFixed' ? fixedParent : slot === 'inheritVariable' ? ctx.variableParent : ctx.unit
  const donorCtx = donor ? unitContext(dataset, run, donor.id) : null
  // The same skill from both parents is only one skill, so each inherit slot blocks the other's pick.
  const otherInherited = slot === 'inheritFixed' ? plan.inheritSkill : slot === 'inheritVariable' ? plan.inheritFixedSkill : undefined
  const inheritedByChild = inherit ? [] : ([[plan.inheritFixedSkill, fixedParent], [plan.inheritSkill, ctx.variableParent]] as const)
    .flatMap(([skillId, parent]) => skillId !== undefined && parent ? [{ skillId, label: `Inherited from ${displayName(parent)}` }] : [])

  const reached = new Set<number>(inheritedByChild.map((entry) => entry.skillId))
  if (!inherit) {
    const progression = buildProgression(dataset, run, ctx)
    for (const learned of progression.startsWith) reached.add(learned.skillId)
    for (const segment of progression.segments) {
      for (const row of segment.rows) for (const learned of row.learned) reached.add(learned.skillId)
    }
  }
  const entries: { skillId: number; label: string }[] = inherit
    ? donorCtx ? inheritableSkillPool(dataset, donorCtx.unit, donorCtx.pool, run.route) : []
    : [
      ...skillPool(dataset, ctx.unit, ctx.pool, run.route).filter((entry) => entry.source !== 'personal'),
      ...inheritedByChild,
      ...(run.dlc ? dlcClassesFor(dataset, ctx.unit.gender).flatMap((def) => def.skillLearn.map((learn) => ({ skillId: learn.id, label: `${classFamily(def.name)} Lv ${learn.level}` }))) : []),
    ]
  const current = inherit ? plan[field] : plan.skills[slot]
  const equippedElsewhere = new Set(plan.skills.filter((id, index) => id !== null && index !== slot) as number[])
  const seen = new Set<number>()
  const unique = entries.filter((entry) => (seen.has(entry.skillId) ? false : (seen.add(entry.skillId), true)))

  const choose = (skillId: number | null) => {
    mutate((next) => {
      const unitPlan = next.units[unitId] ?? emptyUnitPlan()
      let updated: typeof unitPlan
      if (inherit) {
        const { [field]: _old, ...rest } = unitPlan
        updated = skillId === null ? rest : { ...rest, [field]: skillId }
      } else {
        updated = { ...unitPlan, skills: Array.from({ length: SKILL_SLOTS }, (_, index) => (index === slot ? skillId : unitPlan.skills[index] ?? null)) }
      }
      return { ...next, units: { ...next.units, [unitId]: updated } }
    })
    onClose()
  }

  return (
    <Sheet
      title={inherit ? `Inherited from ${donor ? displayName(donor) : 'Parent B'}` : `Skill ${slot + 1} for ${name}`}
      onClose={onClose}
      actions={current != null ? <button type="button" className="text-btn" onClick={() => choose(null)}>Clear</button> : null}
    >
      {inherit && !donor ? <p className="empty-note">Choose a second parent on the Parents tab first.</p> : null}
      <div className="pick-list">
        {unique.map((entry) => {
          const skill = dataset.skillsById.get(entry.skillId)
          if (!skill) return null
          const offRoute = !inherit && !reached.has(entry.skillId)
          const fromOther = entry.skillId === otherInherited
          const taken = equippedElsewhere.has(entry.skillId) && !inherit
          return (
            <SkillCard
              key={entry.skillId}
              skill={{ id: skill.id, name: skill.name, description: skill.description }}
              selected={entry.skillId === current}
              disabled={taken || fromOther}
              onClick={() => choose(entry.skillId)}
              tag={<>{entry.label}{offRoute ? ' · Not on route' : ''}{taken ? ' · Equipped' : ''}{fromOther ? ' · From other parent' : ''}</>}
            />
          )
        })}
      </div>
    </Sheet>
  )
}

function SortSheet({ target, onClose }: { target: 'roster' | 'chart'; onClose(): void }) {
  const ui = useUi()
  const [closing, setClosing] = useState(false)
  const sort = target === 'roster' ? ui.rosterSort : ui.chartSort
  const setSort = target === 'roster' ? ui.setRosterSort : ui.setChartSort
  const favouritesFirst = target === 'roster' ? ui.rosterFavouritesFirst : ui.chartFavouritesFirst
  const linkPairs = target === 'roster' ? ui.rosterLinkPairs : ui.chartLinkPairs
  const generation = target === 'roster' ? ui.rosterGeneration : ui.chartGeneration
  const setGeneration = target === 'roster' ? ui.setRosterGeneration : ui.setChartGeneration
  const blank = blankColumns(ui.rosterLens)
  const closeAnimated = () => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 180)
  }
  const pick = (next: RosterSort) => setSort({ ...next, direction: directionOfSort(next) })
  const toggleDirection = (direction: 'asc' | 'desc') => setSort({ ...sort, direction })
  const setFavourites = (value: boolean) => target === 'roster' ? ui.setRosterFavouritesFirst(value) : ui.setChartFavouritesFirst(value)
  const setLinked = (value: boolean) => target === 'roster' ? ui.setRosterLinkPairs(value) : ui.setChartLinkPairs(value)
  const sortRows: { sort: RosterSort; label: string }[] = [
    { sort: { kind: 'recruit' }, label: 'Recruit order' },
    { sort: { kind: 'name' }, label: 'Name' },
    ...STAT_TABLE_KEYS.map((key, column) => ({ sort: { kind: 'stat' as const, column }, label: STAT_TABLE_LABELS[key] })),
  ]
  return (
    <Sheet title={`Sort ${target === 'roster' ? 'roster' : 'chart'} by`} onClose={closeAnimated} closing={closing}>
      <div className="pick-list">
        {sortRows.map((option) => {
          const active = sort.kind === option.sort.kind && (sort.kind !== 'stat' || (option.sort.kind === 'stat' && sort.column === option.sort.column))
          const disabled = option.sort.kind === 'stat' && blank.includes(option.sort.column)
          return <button key={option.label} type="button" className="sort-row" aria-pressed={active} disabled={disabled} onClick={() => pick(option.sort)}>
            <SortIcon sort={{ ...option.sort, direction: directionOfSort(sort) }} size={30} />
            {option.label}
          </button>
        })}
      </div>
      <div className="sort-direction">
        <span className="sub-title">Direction</span>
        <Segmented label="Sort direction" value={directionOfSort(sort)} options={[{ id: 'asc', label: 'Ascending' }, { id: 'desc', label: 'Descending' }]} onChange={toggleDirection} />
      </div>
      <div className="sort-direction">
        <span className="sub-title">Show</span>
        <Segmented label="Show units" value={generation} options={[{ id: 'all', label: 'All' }, { id: 'first', label: 'First gen' }, { id: 'children', label: 'Children' }]} onChange={setGeneration} />
      </div>
      <div className="sort-toggles">
        <label className="switch-row">
          <span className="sub-title">Favourites first</span>
          <input type="checkbox" role="switch" checked={favouritesFirst} onChange={(event) => setFavourites(event.target.checked)} />
        </label>
        <label className="switch-row">
          <span className="sub-title">Link pair-up partners</span>
          <input type="checkbox" role="switch" checked={linkPairs} onChange={(event) => setLinked(event.target.checked)} />
        </label>
      </div>
      <button type="button" className="btn primary sort-done" onClick={closeAnimated}>Done</button>
    </Sheet>
  )
}
