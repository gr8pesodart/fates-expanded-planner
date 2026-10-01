import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ClassSprite, Portrait } from '../components/art'
import { Icon } from '../components/icons'
import type { SlotKind } from '../components/slots'
import { slotLabel } from '../components/slots'
import { Sheet } from '../components/Sheet'
import { Rail, Segmented, StarButton, Switch } from '../components/controls'
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
import { SKILL_GROUP_ORDER, skillAccess } from '../logic/skillAccess'
import type { RosterSort } from '../logic/rosterSort'
import { directionOfSort } from '../logic/rosterSort'
import type { ParentSort } from '../logic/parents'
import { parentSortDirection, parentSortIcon } from '../logic/parents'
import { toggleFavouriteSkill, toggleFriendshipPartner } from '../logic/relationships'
import { inheritableSkillPool } from '../logic/skills'
import { SKILL_SLOTS, emptyUnitPlan } from '../state/model'
import { applyBond, bondOf, usePickers } from './pickerStore'
import type { SkillTarget } from './pickerStore'
import { usePlanner } from './plannerContext'
import { useUi } from './ui'
import type { SkillPickerTab } from './ui'
import { SlideSwap } from '../components/SlideSwap'
import { useSwipePager } from '../lib/swipe'
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
  locked: 'Requires support',
  unavailable: 'Not accessible',
}

const PICKER_TABS: { id: SkillPickerTab; label: string }[] = [
  { id: 'starred', label: 'Starred' },
  { id: 'grouped', label: 'Grouped' },
  { id: 'ungrouped', label: 'Ungrouped' },
]

/**
 * Marks sticky group headings once they're pinned so their bottom border fades in. A pinned heading
 * sits 1px above the sheet body's top edge (`top: -11px`), so "pinned" = top above that edge. (An
 * IntersectionObserver can't tell: the full-bleed headings are never fully inside the body, so
 * pinned and unpinned ratios fall between the same thresholds.)
 */
function useStuckHeadings(ref: { current: HTMLElement | null }, tab: SkillPickerTab, list: unknown): void {
  useEffect(() => {
    const root = ref.current?.closest('.sheet-body')
    if (!root) return
    let frame = 0
    const update = () => {
      frame = 0
      const edge = root.getBoundingClientRect().top
      root.querySelectorAll<HTMLElement>('.skill-pick-group > .pick-heading').forEach((heading) => {
        const box = heading.getBoundingClientRect()
        heading.toggleAttribute('data-stuck', box.top < edge && box.bottom > edge)
      })
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [ref, tab, list])
}

/** S / A+ (Corrin: A) relationship toggles for what counts as a way in; a small menu beside close. */
function SkillFilterMenu({ corrin }: { corrin: boolean }) {
  const { skillFilters, setSkillFilters } = useUi()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  const filtered = !skillFilters.s || !skillFilters.a
  return (
    <div ref={ref} className="filter-menu-wrap">
      <button type="button" className="icon-btn" aria-label="Filter skills" aria-expanded={open} data-active={filtered || undefined} onClick={() => setOpen(!open)}>
        <Icon name="filter" size={22} />
      </button>
      {open ? (
        <div className="filter-menu" role="dialog" aria-label="Skill filters">
          <label className="switch-row">
            <span className="sub-title">S rank flexible</span>
            <Switch checked={skillFilters.s} onChange={(s) => setSkillFilters({ ...skillFilters, s })} />
          </label>
          <label className="switch-row">
            <span className="sub-title">{corrin ? 'A rank' : 'A+ rank'} flexible</span>
            <Switch checked={skillFilters.a} onChange={(a) => setSkillFilters({ ...skillFilters, a })} />
          </label>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Every skill the unit could hold in this run, and those it can't (skillAccess.ts). Tabs: Starred
 * (the unit's starred skills), Grouped (by how far the plan is from them, then by teaching class —
 * a skill several classes teach is listed under each) and Ungrouped (one list with the Profile's
 * coloured notices). Picking a skill equipped in another slot swaps the two slots.
 */
function EquipSkillPicker({ unitId, slot, onClose }: { unitId: string; slot: number; onClose(): void }) {
  const { dataset, run, mutate, readOnly } = usePlanner()
  const collapsed = useUi((state) => state.collapsedSkillClasses[unitId])
  const toggleSkillClass = useUi((state) => state.toggleSkillClass)
  const tab = useUi((state) => state.skillPickerTab)
  const setTab = useUi((state) => state.setSkillPickerTab)
  const filters = useUi((state) => state.skillFilters)
  const ctx = useMemo(() => unitContext(dataset, run, unitId), [dataset, run, unitId])
  const access = useMemo(() => (ctx ? skillAccess(dataset, run, ctx, filters) : null), [dataset, run, ctx, filters])
  const bodyRef = useRef<HTMLDivElement>(null)
  const tabIndex = PICKER_TABS.findIndex((item) => item.id === tab)
  useSwipePager(bodyRef, tabIndex, PICKER_TABS.length, (next) => setTab(PICKER_TABS[next].id))
  useStuckHeadings(bodyRef, tab, access)
  if (!ctx || !access) return null
  const plan = run.units[unitId] ?? emptyUnitPlan()
  const current = plan.skills[slot]
  const starred = new Set(plan.favouriteSkills ?? [])

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

  const card = (item: SkillAccess, level: number | null, coloured: boolean) => {
    const skill = dataset.skillsById.get(item.skillId)
    if (!skill) return null
    const equippedElsewhere = plan.skills.some((id, index) => id === item.skillId && index !== slot)
    return (
      <div className="pick-skill">
        <SkillCard
          skill={{ id: skill.id, name: skill.name, description: skill.description }}
          selected={item.skillId === current}
          muted={equippedElsewhere}
          tag={[level !== null ? `Lv ${level}` : null, equippedElsewhere ? 'Equipped · tap to swap' : null].filter(Boolean).join(' · ') || undefined}
          notice={coloured ? <SkillNotice access={item} corrin={ctx.unit.isCorrin} /> : undefined}
          onClick={() => choose(item.skillId)}
        />
        <StarButton
          className="pick-skill-star"
          on={starred.has(item.skillId)}
          name={skill.name}
          disabled={readOnly}
          onToggle={() => mutate((next) => toggleFavouriteSkill(next, unitId, item.skillId))}
        />
      </div>
    )
  }

  // Grouped lists whole classes in their own status, so a skill two classes teach shows twice.
  const grouped = SKILL_GROUP_ORDER.map((group) => ({ group, classes: access.classes.filter((record) => record.group === group) }))
    .filter((item) => item.classes.length)

  const content = tab === 'grouped' ? (
    grouped.map(({ group, classes }) => (
      <section key={group} className="skill-pick-group" aria-label={GROUP_TITLE[group]}>
        <h3 className="pick-heading">{GROUP_TITLE[group]}</h3>
        {classes.map((record) => {
          const { classId } = record
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
              {/* Always rendered so collapsing can animate its height (grid-template-rows 0fr ↔ 1fr). */}
              <div className="skill-class-body" data-open={open || undefined} inert={!open}>
                <div className="pick-list">
                  {/* Only acquisition guidance here: the group heading already says "Not in progression". */}
                  {group === 'available' || group === 'progression' ? null : <SkillNotice access={record} grey perClass corrin={ctx.unit.isCorrin} />}
                  {record.skills.map(({ skillId, level }) => {
                    const item = access.byId.get(skillId)
                    return item ? <Fragment key={skillId}>{card(item, level, false)}</Fragment> : null
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </section>
    ))
  ) : (
    <div className="pick-list">
      {tab === 'starred' && !access.list.some((item) => starred.has(item.skillId))
        ? <p className="empty-note">Star skills in the other tabs to keep them here.</p>
        : null}
      {access.list
        .filter((item) => tab === 'ungrouped' || starred.has(item.skillId))
        .map((item) => <Fragment key={item.skillId}>{card(item, item.level, true)}</Fragment>)}
    </div>
  )

  return (
    <Sheet
      title={`Skill ${slot + 1} for ${displayName(ctx.unit, run)}`}
      onClose={onClose}
      toolbar={<Rail variant="tabs" label="Skill list" items={PICKER_TABS} active={tab} onSelect={setTab} />}
      actions={(
        <>
          {current != null ? <button type="button" className="text-btn" onClick={() => choose(null)}>Clear</button> : null}
          <SkillFilterMenu corrin={ctx.unit.isCorrin} />
        </>
      )}
    >
      <div ref={bodyRef} className="skill-pick-body" data-swipe>
        <SlideSwap index={tabIndex}>{content}</SlideSwap>
      </div>
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
          <Switch checked={favouritesFirst} onChange={setFavourites} />
        </label>
        <label className="switch-row">
          <span className="sub-title">Link pair-up partners</span>
          <Switch checked={linkPairs} onChange={setLinked} />
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
          <Switch checked={ui.parentEffective} onChange={ui.setParentEffective} />
        </label>
      </div>
      <button type="button" className="btn primary sort-done" onClick={closeAnimated}>Done</button>
    </Sheet>
  )
}
