import { useMemo, useState } from 'react'
import { ClassSprite, Portrait } from '../components/art'
import { Icon } from '../components/icons'
import type { SlotKind } from '../components/slots'
import { slotLabel } from '../components/slots'
import { Sheet } from '../components/Sheet'
import { Segmented } from '../components/controls'
import { SortIcon } from '../components/SortIcon'
import { SkillCard } from '../components/SkillCard'
import { SkillNotice } from '../components/SkillNotice'
import { STAT_TABLE_KEYS, STAT_TABLE_LABELS } from '../data/types'
import { displayName, unitContext } from '../logic/army'
import { classFamily } from '../logic/classes'
import { blankColumns } from '../logic/lenses'
import type { ClassPoolEntry } from '../logic/classes'
import { dlcClassesFor } from '../logic/progression'
import type { SkillAccess, SkillGroup } from '../logic/skillAccess'
import { classNotice, SKILL_GROUP_ORDER, skillAccess } from '../logic/skillAccess'
import type { RosterSort } from '../logic/rosterSort'
import { directionOfSort } from '../logic/rosterSort'
import type { ParentSort } from '../logic/parents'
import { parentSortDirection, parentSortIcon } from '../logic/parents'
import { toggleFriendshipPartner } from '../logic/relationships'
import { inheritableSkillPool } from '../logic/skills'
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
  if (sort === 'parents') return <ParentSortSheet onClose={close} />
  if (sort) return <SortSheet target={sort} onClose={close} />
  return null
}

function CharacterPicker({ unitId, kind, onClose }: { unitId: string; kind: SlotKind; onClose(): void }) {
  const { dataset, run, mutate } = usePlanner()
  const [query, setQuery] = useState('')
  const owner = dataset.unitsById.get(unitId)
  const candidates = candidatesFor(dataset, run, unitId, kind)
  if (!owner) return null
  const ownerName = displayName(owner, run)
  const subjectId = kind === 'parent' ? owner.fixedParent : unitId
  // Corrin has no A+; the A slot is a set of planned Friendship Seal partners, so picks toggle.
  const multi = kind === 'a' && owner.isCorrin
  const chosen = multi ? run.units[unitId]?.friendshipPartners ?? [] : []
  const current = subjectId && !multi ? run.units[subjectId]?.[bondOf(kind)] : undefined
  const isPicked = (id: string) => (multi ? chosen.includes(id) : id === current)
  const pick = (partnerId: string | null) => {
    if (multi) {
      mutate((next) => toggleFriendshipPartner(next, unitId, partnerId))
      return
    }
    mutate((next) => applyBond(dataset, next, unitId, kind, partnerId))
    onClose()
  }
  const shown = candidates.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <Sheet
      title={`${slotLabel(kind, owner.isCorrin)} for ${ownerName}`}
      onClose={onClose}
      wide
      actions={current || chosen.length ? <button type="button" className="text-btn" onClick={() => pick(null)}>Clear</button> : null}
    >
      {multi ? <p className="empty-note pick-hint">Corrin can't have an A+ rank, but can Friendship Seal into the class of any same-gender A-rank partner. Pick the ones you plan to reach.</p> : null}
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
            aria-pressed={isPicked(item.unit.id)}
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
      {multi ? <button type="button" className="btn primary sort-done" onClick={onClose}>Done</button> : null}
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
  const name = displayName(ctx.unit, run)
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
  return typeof slot === 'number'
    ? <EquipSkillPicker unitId={unitId} slot={slot} onClose={onClose} />
    : <InheritSkillPicker unitId={unitId} slot={slot} onClose={onClose} />
}

const GROUP_TITLE: Record<SkillGroup, string> = {
  progression: 'In progression',
  available: 'Not in progression',
  inheritable: 'Inheritable only',
  locked: 'Not accessible',
}

/**
 * Every skill the unit could ever hold in this run, grouped by how far the plan is from it
 * (skillAccess.ts), then by the class that teaches it. Class groups collapse per unit. Picking a
 * skill equipped in another slot swaps the two slots.
 */
function EquipSkillPicker({ unitId, slot, onClose }: { unitId: string; slot: number; onClose(): void }) {
  const { dataset, run, mutate } = usePlanner()
  const collapsed = useUi((state) => state.collapsedSkillClasses[unitId])
  const toggleSkillClass = useUi((state) => state.toggleSkillClass)
  const ctx = useMemo(() => unitContext(dataset, run, unitId), [dataset, run, unitId])
  const access = useMemo(() => (ctx ? skillAccess(dataset, run, ctx) : null), [dataset, run, ctx])
  if (!ctx || !access) return null
  const plan = run.units[unitId] ?? emptyUnitPlan()
  const current = plan.skills[slot]

  const choose = (skillId: number | null) => {
    mutate((next) => {
      const unitPlan = next.units[unitId] ?? emptyUnitPlan()
      const skills = Array.from({ length: SKILL_SLOTS }, (_, index) => unitPlan.skills[index] ?? null)
      const other = skillId === null ? -1 : skills.findIndex((id, index) => id === skillId && index !== slot)
      if (other >= 0) skills[other] = skills[slot]
      skills[slot] = skillId
      return { ...next, units: { ...next.units, [unitId]: { ...unitPlan, skills } } }
    })
    onClose()
  }

  const groups = SKILL_GROUP_ORDER.map((group) => {
    const classes = new Map<number | null, SkillAccess[]>()
    for (const item of access.list) {
      if (item.group === group) classes.set(item.classId, [...(classes.get(item.classId) ?? []), item])
    }
    return { group, classes: [...classes.entries()] }
  }).filter((item) => item.classes.length)

  return (
    <Sheet
      title={`Skill ${slot + 1} for ${displayName(ctx.unit, run)}`}
      onClose={onClose}
      actions={current != null ? <button type="button" className="text-btn" onClick={() => choose(null)}>Clear</button> : null}
    >
      {groups.map(({ group, classes }) => (
        <section key={group} className="skill-pick-group" aria-label={GROUP_TITLE[group]}>
          <h3 className="pick-heading">{GROUP_TITLE[group]}</h3>
          {classes.map(([classId, items]) => {
            const key = `${group}:${classId ?? 'inherited'}`
            const open = !collapsed?.includes(key)
            const def = classId !== null ? dataset.classesById.get(classId) : undefined
            return (
              <div key={key} className="skill-pick-class">
                <button type="button" className="skill-class-head" aria-expanded={open} onClick={() => toggleSkillClass(unitId, key)}>
                  {def ? <ClassSprite unitId={unitId} classId={def.id} name={def.name} size={32} /> : null}
                  <span className="skill-class-name">{def ? classFamily(def.name) : 'Inherited'}</span>
                  <Icon name="chevronDown" size={20} className="skill-class-chevron" />
                </button>
                {open ? (
                  <div className="pick-list">
                    {/* Only acquisition guidance here: the group heading already says "Not in progression". */}
                    {group === 'available' ? null : <SkillNotice access={classNotice(items)} grey perClass corrin={ctx.unit.isCorrin} />}
                    {items.map((item) => {
                      const skill = dataset.skillsById.get(item.skillId)
                      if (!skill) return null
                      const equippedElsewhere = plan.skills.some((id, index) => id === item.skillId && index !== slot)
                      return (
                        <SkillCard
                          key={item.skillId}
                          skill={{ id: skill.id, name: skill.name, description: skill.description }}
                          iconSize={24}
                          selected={item.skillId === current}
                          muted={equippedElsewhere}
                          tag={[item.level !== null ? `Lv ${item.level}` : null, equippedElsewhere ? 'Equipped · tap to swap' : null].filter(Boolean).join(' · ') || undefined}
                          onClick={() => choose(item.skillId)}
                        />
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </section>
      ))}
    </Sheet>
  )
}

/** A child's inherited skill: the chosen parent's inheritable skills. */
function InheritSkillPicker({ unitId, slot, onClose }: { unitId: string; slot: 'inheritFixed' | 'inheritVariable'; onClose(): void }) {
  const { dataset, run, mutate } = usePlanner()
  const ctx = unitContext(dataset, run, unitId)
  if (!ctx) return null
  const plan = run.units[unitId] ?? emptyUnitPlan()
  const fixedParent = ctx.unit.fixedParent ? dataset.unitsById.get(ctx.unit.fixedParent) : undefined
  const field = slot === 'inheritFixed' ? 'inheritFixedSkill' : 'inheritSkill'
  const donor = slot === 'inheritFixed' ? fixedParent : ctx.variableParent
  const donorCtx = donor ? unitContext(dataset, run, donor.id) : null
  // The same skill from both parents is only one skill, so each inherit slot blocks the other's pick.
  const otherInherited = slot === 'inheritFixed' ? plan.inheritSkill : plan.inheritFixedSkill
  const entries = donorCtx ? inheritableSkillPool(dataset, donorCtx.unit, donorCtx.pool, run.route) : []
  const current = plan[field]
  const seen = new Set<number>()
  const unique = entries.filter((entry) => (seen.has(entry.skillId) ? false : (seen.add(entry.skillId), true)))

  const choose = (skillId: number | null) => {
    mutate((next) => {
      const { [field]: _old, ...rest } = next.units[unitId] ?? emptyUnitPlan()
      return { ...next, units: { ...next.units, [unitId]: skillId === null ? rest : { ...rest, [field]: skillId } } }
    })
    onClose()
  }

  return (
    <Sheet
      title={`Inherited from ${donor ? displayName(donor, run) : 'Parent B'}`}
      onClose={onClose}
      actions={current != null ? <button type="button" className="text-btn" onClick={() => choose(null)}>Clear</button> : null}
    >
      {!donor ? <p className="empty-note">Choose a second parent on the Parents tab first.</p> : null}
      <div className="pick-list">
        {unique.map((entry) => {
          const skill = dataset.skillsById.get(entry.skillId)
          if (!skill) return null
          const fromOther = entry.skillId === otherInherited
          return (
            <SkillCard
              key={entry.skillId}
              skill={{ id: skill.id, name: skill.name, description: skill.description }}
              iconSize={24}
              selected={entry.skillId === current}
              disabled={fromOther}
              onClick={() => choose(entry.skillId)}
              tag={<>{entry.label}{fromOther ? ' · From other parent' : ''}</>}
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

const STAT_ROWS = STAT_TABLE_KEYS.slice(0, 8).map((key, column) => ({ label: STAT_TABLE_LABELS[key], column }))

/** Parents tab sort: recruit/name, or a stat of the inherited modifiers or growths (Figma 15:1542). */
function ParentSortSheet({ onClose }: { onClose(): void }) {
  const ui = useUi()
  const [closing, setClosing] = useState(false)
  const sort = ui.parentSort
  const closeAnimated = () => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 180)
  }
  const isActive = (next: ParentSort) => sort.kind === next.kind && ('column' in sort ? 'column' in next && sort.column === next.column : true)
  const pick = (next: ParentSort) => ui.setParentSort({ ...next, direction: parentSortDirection(next) })
  const row = (next: ParentSort, label: string, disabled = false) => (
    <button key={`${next.kind}-${'column' in next ? next.column : ''}`} type="button" className="sort-row" aria-pressed={isActive(next)} disabled={disabled} onClick={() => pick(next)}>
      <SortIcon sort={{ ...parentSortIcon(next), direction: parentSortDirection(sort) }} size={30} />
      {label}
    </button>
  )
  return (
    <Sheet title="Sort parents by" onClose={closeAnimated} closing={closing}>
      <div className="pick-list">
        {row({ kind: 'recruit' }, 'Recruit order')}
        {row({ kind: 'name' }, 'Name')}
      </div>
      <h3 className="sub-title sort-group">Inherited stat modifiers</h3>
      <div className="pick-list">
        {STAT_ROWS.map(({ label, column }) => row({ kind: 'modifier', column }, label, column === 0))}
      </div>
      <h3 className="sub-title sort-group">Inherited stat growths</h3>
      <div className="pick-list">
        {STAT_ROWS.map(({ label, column }) => row({ kind: 'growth', column }, label))}
      </div>
      <div className="sort-direction">
        <span className="sub-title">Direction</span>
        <Segmented label="Sort direction" value={parentSortDirection(sort)} options={[{ id: 'asc', label: 'Ascending' }, { id: 'desc', label: 'Descending' }]} onChange={(direction) => ui.setParentSort({ ...sort, direction })} />
      </div>
      <div className="sort-toggles">
        <label className="switch-row">
          <span className="sub-title">Show the child's resulting values</span>
          <input type="checkbox" role="switch" checked={ui.parentEffective} onChange={(event) => ui.setParentEffective(event.target.checked)} />
        </label>
      </div>
      <button type="button" className="btn primary sort-done" onClick={closeAnimated}>Done</button>
    </Sheet>
  )
}
