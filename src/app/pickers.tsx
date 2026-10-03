import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ClassSprite, Portrait } from '../components/art'
import { Icon } from '../components/icons'
import type { SlotKind } from '../components/slots'
import { slotLabel } from '../components/slots'
import { Sheet } from '../components/Sheet'
import { Rail, Segmented, StarButton, Switch } from '../components/controls'
import { SortIcon } from '../components/SortIcon'
import { SkillCard } from '../components/SkillCard'
import { ConflictNotice, SkillNotice } from '../components/SkillNotice'
import { PagerPage, TabPager } from '../components/TabPager'
import { ItemIcon } from '../components/ItemIcon'
import { bookItemKey } from '../data/itemIcons'
import { useMountedTabs } from '../lib/useMountedTabs'
import { STAT_TABLE_KEYS, STAT_TABLE_LABELS } from '../data/types'
import { displayName, unitContext } from '../logic/army'
import { classFamily, sexedClassId } from '../logic/classes'
import { blankColumns } from '../logic/lenses'
import type { ClassPoolEntry } from '../logic/classes'
import { dlcClassesFor } from '../logic/progression'
import type { ClassAccess, SkillAccess, SkillFilters, SkillGroup } from '../logic/skillAccess'
import { SKILL_GROUP_ORDER, skillAccess } from '../logic/skillAccess'
import type { RosterSort } from '../logic/rosterSort'
import { directionOfSort } from '../logic/rosterSort'
import type { ParentSort } from '../logic/parents'
import { parentSortDirection, parentSortIcon } from '../logic/parents'
import { toggleFavouriteSkill, toggleFriendshipPartner } from '../logic/relationships'
import type { SkillPoolEntry } from '../logic/skills'
import { inheritableSkillPool } from '../logic/skills'
import { SKILL_SLOTS, emptyUnitPlan } from '../state/model'
import { applyBond, bondOf, usePickers } from './pickerStore'
import type { SkillTarget } from './pickerStore'
import { usePlanner } from './plannerContext'
import { useSkillFilters, useUi } from './ui'
import type { SkillPickerTab } from './ui'
import { acquiredVia, skillRules } from './unitViews'
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
                <ClassSprite unitId={unitId} classId={classId} name={def.name} size={32} />
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
const PICKER_TAB_IDS = PICKER_TABS.map((item) => item.id)

/**
 * Grouped view's table of contents (owner, v3.4): a sticky pill rail in place of sticky group
 * headings. The pill follows the scroll; tapping one scrolls its group to just under the rail.
 */
function GroupToc({ groups }: { groups: readonly { id: string; label: string }[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(groups[0]?.id ?? '')
  // While a tapped pill's smooth scroll runs, the groups it passes don't take the highlight.
  const jumping = useRef<number | null>(null)
  const key = groups.map((group) => group.id).join(' ')
  useEffect(() => {
    const toc = ref.current
    const scroller = toc?.closest('.skill-pick-page')
    if (!toc || !scroller) return
    const list = key.split(' ')
    let frame = 0
    const update = () => {
      frame = 0
      if (jumping.current !== null) return
      const edge = toc.getBoundingClientRect().bottom + 1
      let current = list[0]
      for (const group of list) {
        const section = scroller.querySelector(`[data-group="${group}"]`)
        if (section && section.getBoundingClientRect().top <= edge) current = group
      }
      // A short last group can't reach the top; at the very bottom it's the one being read.
      if (scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) current = list[list.length - 1]
      setActive(current)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [key])
  const jump = (group: string) => {
    const toc = ref.current
    const scroller = toc?.closest('.skill-pick-page')
    const section = scroller?.querySelector(`[data-group="${group}"]`)
    if (!toc || !scroller || !section) return
    setActive(group)
    const top = section.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - toc.offsetHeight
    if (jumping.current !== null) window.clearTimeout(jumping.current)
    const release = () => {
      if (jumping.current !== null) window.clearTimeout(jumping.current)
      jumping.current = null
      scroller.removeEventListener('scrollend', release)
      // Re-sync the highlight with where the scroll actually ended.
      scroller.dispatchEvent(new Event('scroll'))
    }
    scroller.addEventListener('scrollend', release)
    jumping.current = window.setTimeout(release, 1200)
    scroller.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  return (
    <div ref={ref} className="skill-toc">
      <Rail variant="pills" label="Skill groups" items={groups} active={active} onSelect={jump} />
    </div>
  )
}

/** One class in a Grouped view: its head, an optional grey notice, then its cards. */
interface ClassBlock {
  key: string
  head: ReactNode
  faded?: boolean
  notice?: ReactNode
  cards: ReactNode
}

/**
 * The Grouped view both skill pickers share: the TOC pill rail, then each group's heading and its
 * classes, which collapse (state per unit) by animating `grid-template-rows` 0fr ↔ 1fr.
 */
function GroupedSkills({ unitId, groups }: { unitId: string; groups: { id: string; label: string; classes: ClassBlock[] }[] }) {
  const collapsed = useUi((state) => state.collapsedSkillClasses[unitId])
  const toggleSkillClass = useUi((state) => state.toggleSkillClass)
  const shown = groups.filter((group) => group.classes.length)
  return (
    <>
      <GroupToc groups={shown} />
      {shown.map((group) => (
        <section key={group.id} className="skill-pick-group" data-group={group.id} aria-label={group.label}>
          <h3 className="pick-heading">{group.label}</h3>
          {group.classes.map((block) => {
            const open = !collapsed?.includes(block.key)
            return (
              <div key={block.key} className="skill-pick-class">
                <button type="button" className="skill-class-head" aria-expanded={open} data-faded={block.faded || undefined} onClick={() => toggleSkillClass(unitId, block.key)}>
                  {block.head}
                  <Icon name="chevronDown" size={20} className="skill-class-chevron" />
                </button>
                {/* Always rendered so collapsing can animate its height. */}
                <div className="skill-class-body" data-open={open || undefined} inert={!open}>
                  <div className="pick-list">
                    {block.notice}
                    {block.cards}
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      ))}
    </>
  )
}

/**
 * The tabbed sheet both skill pickers share: Starred / Grouped / Ungrouped side by side in a swipe
 * pager, all mounted and each scrolling on its own.
 */
function SkillTabsSheet({ title, actions, pages, onClose }: { title: string; actions?: ReactNode; pages: Record<SkillPickerTab, ReactNode>; onClose(): void }) {
  const tab = useUi((state) => state.skillPickerTab)
  const setTab = useUi((state) => state.setSkillPickerTab)
  const bodyRef = useRef<HTMLDivElement>(null)
  const tabIndex = PICKER_TABS.findIndex((item) => item.id === tab)
  useSwipePager(bodyRef, tabIndex, PICKER_TABS.length, (next) => setTab(PICKER_TABS[next].id))
  const mounted = useMountedTabs(tab, PICKER_TAB_IDS, 260)
  return (
    <Sheet title={title} onClose={onClose} toolbar={<Rail variant="tabs" label="Skill list" items={PICKER_TABS} active={tab} onSelect={setTab} />} actions={actions}>
      <div ref={bodyRef} className="skill-pick-body" data-swipe>
        <TabPager fill index={tabIndex}>
          {PICKER_TABS.map((item) => (
            <PagerPage key={item.id} active={item.id === tab} label={item.label} className={`skill-pick-page ${item.id}`}>
              {mounted.has(item.id) ? pages[item.id] : null}
            </PagerPage>
          ))}
        </TabPager>
      </div>
    </Sheet>
  )
}

/**
 * Which relationships count as a way in, kept per character: new S / A+ (Corrin: A) partners and,
 * for a child whose second parent is chosen, other second parents. A small menu beside close.
 */
function SkillFilterMenu({ unitId, corrin, parent }: { unitId: string; corrin: boolean; parent: boolean }) {
  const filters = useSkillFilters(unitId)
  const setSkillFilters = useUi((state) => state.setSkillFilters)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  const set = (next: Partial<SkillFilters>) => setSkillFilters(unitId, { ...filters, ...next })
  const filtered = !filters.s || !filters.a || (parent && !filters.p)
  return (
    <div ref={ref} className="filter-menu-wrap">
      <button type="button" className="icon-btn" aria-label="Filter skills" aria-expanded={open} data-active={filtered || undefined} onClick={() => setOpen(!open)}>
        <Icon name="filter" size={22} />
      </button>
      {open ? (
        <div className="filter-menu" role="dialog" aria-label="Skill filters">
          <label className="switch-row">
            <span className="sub-title">S rank flexible</span>
            <Switch checked={filters.s} onChange={(s) => set({ s })} />
          </label>
          <label className="switch-row">
            <span className="sub-title">{corrin ? 'A rank' : 'A+ rank'} flexible</span>
            <Switch checked={filters.a} onChange={(a) => set({ a })} />
          </label>
          {parent ? (
            <label className="switch-row">
              <span className="sub-title">Parent flexible</span>
              <Switch checked={filters.p} onChange={(p) => set({ p })} />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Every skill the unit could hold in this run, and those it can't (skillAccess.ts). Tabs: Starred
 * (the unit's starred skills), Grouped (by how far the plan is from them, then by teaching class —
 * a skill several classes teach is listed under each) and Ungrouped (one list with the Profile's
 * coloured notices). Picking a skill equipped in another slot swaps the two slots. The tabs sit side
 * by side in a pager and stay mounted, each scrolling on its own.
 */
function EquipSkillPicker({ unitId, slot, onClose }: { unitId: string; slot: number; onClose(): void }) {
  const { dataset, run, mutate, readOnly } = usePlanner()
  const filters = useSkillFilters(unitId)
  const ctx = useMemo(() => unitContext(dataset, run, unitId), [dataset, run, unitId])
  const access = useMemo(() => (ctx ? skillAccess(dataset, run, ctx, filters) : null), [dataset, run, ctx, filters])

  // Built once per plan change, not per tab change: switching tabs then only moves the pager.
  const pages = useMemo(() => {
    if (!ctx || !access) return null
    const plan = run.units[unitId] ?? emptyUnitPlan()
    const current = plan.skills[slot]
    const others = plan.skills.filter((_, index) => index !== slot)
    const starred = new Set(plan.favouriteSkills ?? [])
    const corrin = ctx.unit.isCorrin

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

    /** `grouped`: the class is the heading, so the tag is just the level and notices are per class. */
    const card = (item: SkillAccess, grouped: boolean, level: number | null = item.level) => {
      const skill = dataset.skillsById.get(item.skillId)
      if (!skill) return null
      const elsewhere = plan.skills.findIndex((id, index) => id === item.skillId && index !== slot)
      const rules = skillRules(dataset, item.skillId, others)
      return (
        <SkillCard
          skill={{ id: skill.id, name: skill.name, description: skill.description }}
          selected={item.skillId === current}
          muted={elsewhere >= 0}
          faded={item.group === 'unavailable'}
          label={item.skillId === current ? 'Equipped' : elsewhere >= 0 ? `Equipped in slot ${elsewhere + 1} · tap to swap` : undefined}
          tag={grouped ? (level !== null ? `Lv ${level}` : undefined) : acquiredVia(dataset, run, ctx, item) ?? undefined}
          caution={rules.caution}
          notice={<>{grouped ? null : <SkillNotice access={item} corrin={corrin} />}<ConflictNotice names={rules.conflicts} /></>}
          onClick={() => choose(item.skillId)}
          aside={(
            <StarButton
              on={starred.has(item.skillId)}
              name={skill.name}
              disabled={readOnly}
              onToggle={() => mutate((next) => toggleFavouriteSkill(next, unitId, item.skillId))}
            />
          )}
        />
      )
    }

    const classHead = (record: ClassAccess, group: SkillGroup) => {
      const def = record.classId !== null ? dataset.classesById.get(record.classId) : undefined
      // Inheritable only: every parent who could pass it on (current parents first), in their own
      // version of the class. Kana's can run to nine (owner: keep them all).
      const parents = group === 'inheritable' ? record.inheritFrom : []
      if (record.book) {
        return (
          <>
            <span className="skill-class-sprites skill-class-book"><ItemIcon itemKey={bookItemKey(record.skills[0]?.skillId ?? -1) ?? ''} /></span>
            <span className="skill-class-name">Skill books</span>
          </>
        )
      }
      const sprites = !def ? null : parents.length
        ? parents.map((parent) => <ClassSprite key={parent.id} unitId={parent.id} classId={sexedClassId(dataset, def.id, parent.gender)} name={`${displayName(parent, run)}: ${def.name}`} size={32} />)
        : <ClassSprite unitId={unitId} classId={def.id} name={def.name} size={32} />
      return (
        <>
          {sprites ? <span className="skill-class-sprites">{sprites}</span> : null}
          <span className="skill-class-name">{def ? classFamily(def.name) : 'Inherited'}</span>
        </>
      )
    }

    const grouped = (
      <GroupedSkills
        unitId={unitId}
        groups={SKILL_GROUP_ORDER.map((group) => ({
          id: group,
          label: GROUP_TITLE[group],
          classes: access.classes.filter((record) => record.group === group).map((record) => ({
            key: `${group}:${record.classId ?? (record.book ? 'books' : 'inherited')}`,
            head: classHead(record, group),
            faded: group === 'locked' || group === 'unavailable',
            notice: <SkillNotice access={record} grey perClass corrin={corrin} />,
            cards: record.skills.map(({ skillId, level }) => {
              const item = access.byId.get(skillId)
              return item ? <Fragment key={skillId}>{card(item, true, level)}</Fragment> : null
            }),
          })),
        }))}
      />
    )
    const flat = (only: (item: SkillAccess) => boolean, empty: ReactNode) => {
      const items = access.list.filter(only)
      return (
        <div className="pick-list">
          {items.length ? items.map((item) => <Fragment key={item.skillId}>{card(item, false)}</Fragment>) : empty}
        </div>
      )
    }
    return {
      starred: flat((item) => starred.has(item.skillId), <p className="empty-note">Star skills in the other tabs to keep them here.</p>),
      grouped,
      ungrouped: flat(() => true, null),
      clear: current != null ? <button type="button" className="text-btn" onClick={() => choose(null)}>Clear</button> : null,
    }
  }, [ctx, access, run, unitId, slot, dataset, mutate, onClose, readOnly])

  if (!ctx || !pages) return null
  return (
    <SkillTabsSheet
      title={`Skill ${slot + 1} for ${displayName(ctx.unit, run)}`}
      onClose={onClose}
      pages={pages}
      actions={(
        <>
          {pages.clear}
          <SkillFilterMenu unitId={unitId} corrin={ctx.unit.isCorrin} parent={ctx.isChild && ctx.variableParent !== null} />
        </>
      )}
    />
  )
}

/**
 * A child's inherited skill: what the chosen parent can pass on, split by the parent's own plan
 * (In / Not in the parent's progression) under the same sticky pill rail as the equip picker's
 * Grouped view (owner, v3.4: no tabs, no stars, no class grouping).
 */
function InheritSkillPicker({ unitId, slot, onClose }: { unitId: string; slot: 'inheritFixed' | 'inheritVariable'; onClose(): void }) {
  const { dataset, run, mutate } = usePlanner()
  const ctx = useMemo(() => unitContext(dataset, run, unitId), [dataset, run, unitId])
  const donor = !ctx ? undefined : slot === 'inheritFixed'
    ? (ctx.unit.fixedParent ? dataset.unitsById.get(ctx.unit.fixedParent) : undefined)
    : ctx.variableParent ?? undefined
  const donorCtx = useMemo(() => (donor ? unitContext(dataset, run, donor.id) : null), [dataset, run, donor])
  const field = slot === 'inheritFixed' ? 'inheritFixedSkill' : 'inheritSkill'
  const donorName = donor ? displayName(donor, run) : 'Parent B'

  const body = useMemo(() => {
    if (!ctx) return null
    const plan = run.units[unitId] ?? emptyUnitPlan()
    const current = plan[field]
    // The same skill from both parents is only one skill, so each inherit slot blocks the other's pick.
    const otherInherited = slot === 'inheritFixed' ? plan.inheritSkill : plan.inheritFixedSkill
    const seen = new Set<number>()
    const entries = (donorCtx ? inheritableSkillPool(dataset, donorCtx.unit, donorCtx.pool, run.route) : [])
      .filter((entry) => (seen.has(entry.skillId) ? false : (seen.add(entry.skillId), true)))
    const donorAccess = donorCtx ? skillAccess(dataset, run, donorCtx) : null

    const choose = (skillId: number | null) => {
      mutate((next) => {
        const { [field]: _old, ...rest } = next.units[unitId] ?? emptyUnitPlan()
        return { ...next, units: { ...next.units, [unitId]: skillId === null ? rest : { ...rest, [field]: skillId } } }
      })
      onClose()
    }

    const card = (entry: SkillPoolEntry) => {
      const skill = dataset.skillsById.get(entry.skillId)
      if (!skill) return null
      const fromOther = entry.skillId === otherInherited
      return (
        <SkillCard
          key={entry.skillId}
          skill={{ id: skill.id, name: skill.name, description: skill.description }}
          selected={entry.skillId === current}
          disabled={fromOther}
          highlight={plan.skills.includes(entry.skillId)}
          label={[plan.skills.includes(entry.skillId) ? 'Equipped' : null, fromOther ? 'From the other parent' : null].filter(Boolean).join(' · ') || undefined}
          tag={entry.label}
          caution={skillRules(dataset, entry.skillId, []).caution}
          onClick={() => choose(entry.skillId)}
        />
      )
    }

    // One flat list per group (owner: no class grouping here); each card's tag names the class.
    const learned = (entry: SkillPoolEntry) => donorAccess?.byId.get(entry.skillId)?.group === 'progression'
    // The child's own equipped skills lead each group (owner, v3.4).
    const equippedFirst = (items: SkillPoolEntry[]) => [...items.filter((entry) => plan.skills.includes(entry.skillId)), ...items.filter((entry) => !plan.skills.includes(entry.skillId))]
    const groups = [
      { id: 'in', label: `In ${donorName}'s progression`, items: equippedFirst(entries.filter(learned)) },
      { id: 'out', label: `Not in ${donorName}'s progression`, items: equippedFirst(entries.filter((entry) => !learned(entry))) },
    ].filter((group) => group.items.length)
    return {
      list: !donor ? <p className="empty-note">Choose a second parent on the Parents tab first.</p> : (
        <>
          <GroupToc groups={groups} />
          {groups.map((group) => (
            <section key={group.id} className="skill-pick-group" data-group={group.id} aria-label={group.label}>
              <h3 className="pick-heading">{group.label}</h3>
              <div className="pick-list">{group.items.map(card)}</div>
            </section>
          ))}
        </>
      ),
      clear: current != null ? <button type="button" className="text-btn" onClick={() => choose(null)}>Clear</button> : null,
    }
  }, [ctx, donor, donorCtx, donorName, dataset, run, unitId, field, slot, mutate, onClose])

  if (!ctx || !body) return null
  return (
    <Sheet title={`Inherited from ${donorName}`} onClose={onClose} actions={body.clear}>
      <div className="skill-pick-body">
        <div className="skill-pick-page grouped">{body.list}</div>
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
