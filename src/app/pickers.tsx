import { useState } from 'react'
import { ClassSprite, Portrait } from '../components/art'
import { Icon } from '../components/icons'
import type { IconName } from '../components/icons'
import type { SlotKind } from '../components/slots'
import { SLOT_LABEL } from '../components/slots'
import { Sheet } from '../components/Sheet'
import { SkillCard } from '../components/SkillCard'
import { STAT_KEYS, STAT_LABELS } from '../data/types'
import { displayName, unitContext } from '../logic/army'
import { classFamily } from '../logic/classes'
import { blankColumns } from '../logic/lenses'
import type { ClassPoolEntry } from '../logic/classes'
import { buildProgression, dlcClassesFor } from '../logic/progression'
import type { RosterSort } from '../logic/rosterSort'
import { skillPool } from '../logic/skills'
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
  if (sort) return <SortSheet onClose={close} />
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
  const inherit = slot === 'inherit'
  const donor = inherit ? ctx.variableParent : ctx.unit
  const donorCtx = donor ? unitContext(dataset, run, donor.id) : null
  const pool = donorCtx ? skillPool(dataset, donorCtx.unit, donorCtx.pool, run.route) : []
  const dlcSkills = run.dlc && donorCtx
    ? dlcClassesFor(dataset, donorCtx.unit.gender).flatMap((def) => def.skillLearn.map((learn) => ({ skillId: learn.id, label: `${classFamily(def.name)} Lv ${learn.level}`, source: 'dlc' as const })))
    : []
  const reached = new Set<number>()
  if (!inherit) {
    for (const segment of buildProgression(dataset, run, ctx).segments) {
      for (const row of segment.rows) for (const learned of [...row.startsWith, ...row.learned]) reached.add(learned.skillId)
    }
  }
  const plan = run.units[unitId] ?? emptyUnitPlan()
  const current = inherit ? plan.inheritSkill : plan.skills[slot as number]
  const equippedElsewhere = new Set(plan.skills.filter((id, index) => id !== null && index !== slot) as number[])
  const entries = [...pool.filter((entry) => entry.source !== 'personal'), ...dlcSkills]
  const seen = new Set<number>()
  const unique = entries.filter((entry) => (seen.has(entry.skillId) ? false : (seen.add(entry.skillId), true)))

  const choose = (skillId: number | null) => {
    mutate((next) => {
      const unitPlan = next.units[unitId] ?? emptyUnitPlan()
      const updated = inherit
        ? { ...unitPlan, inheritSkill: skillId ?? undefined }
        : { ...unitPlan, skills: Array.from({ length: SKILL_SLOTS }, (_, index) => (index === slot ? skillId : unitPlan.skills[index] ?? null)) }
      if (inherit && skillId === null) delete updated.inheritSkill
      return { ...next, units: { ...next.units, [unitId]: updated } }
    })
    onClose()
  }

  return (
    <Sheet
      title={inherit ? `Inherited skill for ${name}` : `Skill ${(slot as number) + 1} for ${name}`}
      onClose={onClose}
      actions={current != null ? <button type="button" className="text-btn" onClick={() => choose(null)}>Clear</button> : null}
    >
      {inherit && !donor ? <p className="empty-note">Choose Parent B on the Profile tab first.</p> : null}
      <div className="pick-list">
        {unique.map((entry) => {
          const skill = dataset.skillsById.get(entry.skillId)
          if (!skill) return null
          const offRoute = !inherit && !reached.has(entry.skillId)
          return (
            <SkillCard
              key={entry.skillId}
              skill={{ id: skill.id, name: skill.name, description: skill.description }}
              selected={entry.skillId === current}
              disabled={equippedElsewhere.has(entry.skillId)}
              onClick={() => choose(entry.skillId)}
              tag={<>{entry.label}{offRoute ? ' · Not on route' : ''}{equippedElsewhere.has(entry.skillId) ? ' · Equipped' : ''}</>}
            />
          )
        })}
      </div>
    </Sheet>
  )
}

const SORT_OPTIONS: { sort: RosterSort; label: string; icon: IconName }[] = [
  { sort: { kind: 'recruit' }, label: 'Recruit order', icon: 'sortRecruit' },
  { sort: { kind: 'name' }, label: 'Name', icon: 'sortAlpha' },
]

function SortSheet({ onClose }: { onClose(): void }) {
  const { rosterSort, setRosterSort } = useUi()
  const blank = blankColumns(useUi((state) => state.rosterLens))
  const pick = (sort: RosterSort) => {
    setRosterSort(sort)
    onClose()
  }
  return (
    <Sheet title="Sort by" onClose={onClose}>
      <div className="pick-list">
        {SORT_OPTIONS.map((option) => (
          <button key={option.label} type="button" className="sort-row" aria-pressed={rosterSort.kind === option.sort.kind} onClick={() => pick(option.sort)}>
            <Icon name={option.icon} size={24} />
            {option.label}
          </button>
        ))}
      </div>
      <h3 className="sub-title muted sort-stat-title">Stat (current tab, highest first)</h3>
      <div className="sort-stats">
        {STAT_KEYS.map((key, column) => (
          <button
            key={key}
            type="button"
            className="chip"
            aria-pressed={rosterSort.kind === 'stat' && rosterSort.column === column}
            disabled={blank.includes(column)}
            onClick={() => pick({ kind: 'stat', column })}
          >
            {STAT_LABELS[key]}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
