import { Fragment, useMemo, useState } from 'react'
import { usePickers } from '../../app/pickerStore'
import { usePlanner } from '../../app/plannerContext'
import { SkillIcon } from '../../components/art'
import { Icon } from '../../components/icons'
import { Segmented } from '../../components/controls'
import { SkillCard } from '../../components/SkillCard'
import { StatTable } from '../../components/StatTable'
import { useToast } from '../../components/toast'
import type { Dataset, UnitDef } from '../../data/types'
import type { ClassStart, UnitContext } from '../../logic/army'
import { displayName, skillsChildrenInherit, unitContext } from '../../logic/army'
import { classFamily } from '../../logic/classes'
import type { LearnedSkill, LevelRow, ReclassSeal } from '../../logic/progression'
import { buildProgression, learnedSkillIds, tierCap, withReclass } from '../../logic/progression'
import { ItemIcon } from '../../components/ItemIcon'
import { Sheet } from '../../components/Sheet'
import { SealTally } from '../../components/SealTally'
import { tallyItems } from '../../logic/tally'
import type { AutoPlan, AutoResult } from '../../logic/autoProgression'
import { bookOrClassChoices, skillBooksUsed } from '../../logic/autoProgression'
import { planProgression } from '../../app/autoPlanner'
import { bookItemKey, classItemKey, itemName, sealItemKey } from '../../data/itemIcons'
import type { Reclass, RunPlan } from '../../state/model'
import { emptyUnitPlan } from '../../state/model'
import { acquiredVia, skillRules, skillView } from '../../app/unitViews'
import { ConflictNotice, SkillNotice } from '../../components/SkillNotice'
import type { SkillAccess, SkillAccessMap } from '../../logic/skillAccess'
import { skillAccess, unreachableSkill } from '../../logic/skillAccess'

const SEAL_LABEL: Record<ReclassSeal, string> = {
  offspring: 'Offspring Seal',
  master: 'Master Seal',
  heart: 'Heart Seal',
  partner: 'Partner Seal',
  friendship: 'Friendship Seal',
  dlc: 'DLC',
}

const SEAL_ORDER: ReclassSeal[] = ['offspring', 'master', 'heart', 'partner', 'friendship', 'dlc']

function withUnitPlan(run: RunPlan, unitId: string, update: (plan: RunPlan['units'][string]) => RunPlan['units'][string]): RunPlan {
  return { ...run, units: { ...run.units, [unitId]: update(run.units[unitId] ?? emptyUnitPlan()) } }
}

export function ProgressionTab({ ctx }: { ctx: UnitContext }) {
  const { dataset, run, readOnly, mutate } = usePlanner()
  const showToast = useToast((state) => state.show)
  const openPicker = usePickers((state) => state.open)
  const [open, setOpen] = useState<string | null>(null)
  const [automating, setAutomating] = useState(false)
  const [eternalOffer, setEternalOffer] = useState<AutoResult | null>(null)
  // Skills a book or a class could teach: the player picks before planning (owner, v3.4).
  const [bookChoice, setBookChoice] = useState<{ skills: number[]; book: number[] } | null>(null)
  // A child with an Offspring Seal: the best plan with it, and the cheaper one without, to choose from.
  const [offspringChoice, setOffspringChoice] = useState<{ withSeal: AutoResult | null; without: AutoResult } | null>(null)
  const progression = useMemo(() => buildProgression(dataset, run, ctx), [dataset, run, ctx])
  const unitId = ctx.unit.id
  const access = useMemo(() => skillAccess(dataset, run, ctx), [dataset, run, ctx])
  const equippedIds = ctx.plan.skills.filter((id): id is number => id !== null)
  const equipped = equippedIds.map((id) => access.byId.get(id) ?? unreachableSkill(id))
  // Skills this unit's children plan to inherit from it: they need to be on this unit's path too.
  const childPicks = useMemo(() => skillsChildrenInherit(dataset, run, unitId), [dataset, run, unitId])
  const unresolved = (item: SkillAccess) => item.group === 'available' || item.group === 'locked' || item.group === 'unavailable'
  // Equipped skills the planned path doesn't teach, then children's picks it doesn't teach either.
  const offPath = [
    ...equipped.filter(unresolved),
    ...[...childPicks.keys()].filter((id) => !equippedIds.includes(id)).map((id) => access.byId.get(id) ?? unreachableSkill(id)).filter(unresolved),
  ]
  const toInherit = equipped.filter((item) => item.group === 'inheritable')
  // Equipped skills the path doesn't teach come from their skill book (DLC on), counted with the seals.
  const booksUsed = useMemo(() => skillBooksUsed(run, ctx, learnedSkillIds(progression)), [run, ctx, progression])
  const tally = useMemo(() => tallyItems(dataset, [{ progression, books: booksUsed }]), [dataset, progression, booksUsed])

  /** Applies a plan change, then removes reclasses the new path can no longer reach. */
  const commit = (update: (plan: RunPlan['units'][string]) => RunPlan['units'][string]) => {
    const nextRun = withUnitPlan(run, unitId, update)
    const nextCtx = unitContext(dataset, nextRun, unitId)
    const dropped = nextCtx ? buildProgression(dataset, nextRun, nextCtx).dropped : []
    mutate((current) => withUnitPlan(current, unitId, (plan) => {
      const next = update(plan)
      const kept: Reclass[] = next.reclasses.filter((item) => !dropped.some((gone) => gone.segment === item.segment && gone.level === item.level && gone.classId === item.classId))
      return { ...next, reclasses: kept }
    }))
    if (dropped.length) showToast(`Removed ${dropped.length} later reclass${dropped.length === 1 ? '' : 'es'} that no longer fit.`)
  }

  const applyAuto = (plan: AutoPlan, result: AutoResult) => {
    mutate((current) => withUnitPlan(current, unitId, ({ eternalSeals: _old, ...unitPlan }) => ({
      ...unitPlan,
      classId: ctx.currentClassId,
      reclasses: plan.reclasses,
      ...(plan.eternalSeals ? { eternalSeals: plan.eternalSeals } : {}),
    })))
    showToast(autoSummary(dataset, access, result, plan))
  }

  const finish = (result: AutoResult | null) => {
    if (!result || (!result.plan && !result.withEternal)) {
      showToast(`No path ends in ${classFamily(dataset.classesById.get(ctx.currentClassId)?.name ?? '?')} with every equipped skill.`)
      return
    }
    if (result.withEternal) setEternalOffer(result)
    else if (result.plan) applyAuto(result.plan, result)
  }

  // The search runs in a worker (app/autoPlanner.ts); the button shows "Planning…" meanwhile. A child
  // carrying an Offspring Seal plans with it (owner, v3.4) unless going without needs fewer seals -
  // then the player chooses.
  const plan = async (bookSkills: number[]) => {
    setBookChoice(null)
    setAutomating(true)
    if (!ctx.start.child?.offspringLevel) {
      const result = await planProgression(run, unitId, bookSkills)
      setAutomating(false)
      finish(result)
      return
    }
    const [withSeal, without] = await Promise.all([
      planProgression(run, unitId, bookSkills, 'require'),
      planProgression(run, unitId, bookSkills, 'forbid'),
    ])
    setAutomating(false)
    // Compare without Eternal Seals first (those are offered on top); if neither fits without them,
    // compare the Eternal Seal plans.
    const cheaper = (a: AutoPlan | null | undefined, b: AutoPlan | null | undefined) => Boolean(a && (!b || a.sealCount < b.sealCount))
    const skipWins = without && (without.plan || withSeal?.plan
      ? cheaper(without.plan, withSeal?.plan)
      : cheaper(without.withEternal, withSeal?.withEternal))
    if (without && skipWins) setOffspringChoice({ withSeal, without })
    else finish(withSeal)
  }

  const automate = () => {
    const choices = bookOrClassChoices(dataset, run, ctx)
    if (choices.length) setBookChoice({ skills: choices, book: [] })
    else void plan([])
  }

  const setReclass = (row: LevelRow, classId: number | null, seal?: 'offspring') => commit((plan) => ({ ...plan, reclasses: withReclass(plan.reclasses, row.segment, row.level, classId, seal) }))

  // A later chapter can make an earlier Offspring Seal pick illegal; commit() drops what no longer fits.
  const setJoinChapter = (chapter: number) => commit(({ joinChapter: _old, ...plan }) => (
    chapter === ctx.start.child?.earliest ? plan : { ...plan, joinChapter: chapter }
  ))

  const setJoinLevel = (level: number) => commit(({ joinLevel: _old, ...plan }) => (
    level === ctx.start.defaultLevel ? plan : { ...plan, joinLevel: level }
  ))

  const setEternal = (count: number) => mutate((current) => withUnitPlan(current, unitId, ({ eternalSeals: _old, ...plan }) => (
    count > 0 ? { ...plan, eternalSeals: count } : plan
  )))

  const last = progression.segments.at(-1)
  const lastRow = last?.rows.at(-1)
  const canEternal = last && last.tier !== 'base' && lastRow?.level === tierCap(last.tier, progression.eternalSeals, ctx.unit.levelCap)
  const joinClass = dataset.classesById.get(ctx.start.classId)
  const fixedParent = ctx.unit.fixedParent ? dataset.unitsById.get(ctx.unit.fixedParent) : undefined
  const joinCap = joinClass ? tierCap(joinClass.tier, 0, ctx.unit.levelCap) : 20

  return (
    <>
      <section className="panel-section join-section" aria-labelledby="join-title">
        <h2 id="join-title" className="section-title">Recruitment</h2>
        <div className="join-line">
          <div className="join-info">
            <span>{ctx.start.chapter ? `${ctx.start.chapter} · ` : ''}{classFamily(joinClass?.name ?? '?')}</span>
            {progression.startsWith.length ? (
              <span className="join-skills" aria-label="Skills on recruitment">
                <SkillChips dataset={dataset} skills={progression.startsWith} />
              </span>
            ) : null}
          </div>
          {ctx.start.child ? (
            <JoinChapterField child={ctx.start.child} level={ctx.start.level} disabled={readOnly} onChange={setJoinChapter} />
          ) : ctx.start.variableLevel ? (
            <JoinLevelField key={ctx.start.level} level={ctx.start.level} cap={joinCap} disabled={readOnly} onCommit={setJoinLevel} />
          ) : <span className="join-level-fixed">Lv {ctx.start.level}</span>}
        </div>
      </section>
      {ctx.isChild ? (
        <section className="panel-section" aria-labelledby="inherit-title">
          <h2 id="inherit-title" className="section-title">Inherited Skills</h2>
          {toInherit.length ? <EquippedNotes ctx={ctx} items={toInherit} label="Equipped skills only a parent can pass on" /> : null}
          <div className="inherit-cards">
            <InheritCard
              dataset={dataset}
              skillId={ctx.plan.inheritFixedSkill}
              parent={fixedParent ? displayName(fixedParent, run) : null}
              disabled={readOnly || !fixedParent}
              onClick={() => openPicker({ skill: { unitId, slot: 'inheritFixed' } })}
            />
            <InheritCard
              dataset={dataset}
              skillId={ctx.plan.inheritSkill}
              parent={ctx.variableParent ? displayName(ctx.variableParent, run) : null}
              disabled={readOnly}
              onClick={() => openPicker({ skill: { unitId, slot: 'inheritVariable' } })}
            />
          </div>
        </section>
      ) : null}
      {offPath.length ? (
        <section className="panel-section" aria-labelledby="offpath-title">
          <h2 id="offpath-title" className="section-title">Not in Progression</h2>
          <EquippedNotes ctx={ctx} items={offPath} childPicks={childPicks} books={booksUsed} label="Equipped or inherited skills this path doesn't teach" />
        </section>
      ) : null}
      {progression.segments.map((segment, segmentIndex) => (
        <section key={segmentIndex} className="panel-section progression" aria-label={segment.label}>
          <div className="section-head progression-head">
            <h2 className="section-title">{segment.label}</h2>
            {segmentIndex === 0 && !readOnly ? (
              <button type="button" className="btn outline auto-btn" disabled={automating} onClick={automate}>
                {automating ? 'Planning…' : 'Automate progression'}
              </button>
            ) : null}
          </div>
          <ol className="level-list">
            {segment.rows.map((row) => {
              const key = `${row.segment}:${row.level}`
              const expanded = open === key
              return (
                <Fragment key={key}>
                  <li className="level-row">
                    <span className="level-num">{row.level}</span>
                    <LearnedLine dataset={dataset} row={row} />
                    <span className="level-leader" aria-hidden="true" />
                    <button
                      type="button"
                      className="info-btn"
                      aria-expanded={expanded}
                      aria-label={`Stats at level ${row.level}`}
                      onClick={() => setOpen(expanded ? null : key)}
                    >
                      <Icon name="info" size={16} />
                    </button>
                    <ReclassSelect dataset={dataset} row={row} first={segmentIndex === 0 && row === segment.rows[0]} disabled={readOnly} onChange={(classId, seal) => setReclass(row, classId, seal)} />
                  </li>
                  {expanded ? (
                    <li className="level-info">
                      <div className="stat-block"><h3 className="sub-title">Expected Stats</h3><StatTable row={row.expected} inverse label="Expected stats" /></div>
                      <div className="stat-block"><h3 className="sub-title">Effective Growth Rate</h3><StatTable row={row.growths} inverse label="Effective growth rate" /></div>
                      <div className="stat-block"><h3 className="sub-title">Effective Pair Up Bonuses</h3><StatTable row={row.pairUp} signed inverse label="Effective pair up bonuses" /></div>
                    </li>
                  ) : null}
                </Fragment>
              )
            })}
          </ol>
        </section>
      ))}
      <div className="progression-foot">
        <SealTally items={tally} />
        {canEternal || progression.eternalSeals > 0 ? (
          <div className="eternal-row">
            <button type="button" className="btn outline" disabled={readOnly || progression.eternalSeals === 0} onClick={() => setEternal(progression.eternalSeals - 1)}>Remove an Eternal Seal</button>
            <button type="button" className="btn primary" title="+5 levels" disabled={readOnly || !canEternal} onClick={() => setEternal(progression.eternalSeals + 1)}>Use Eternal Seal</button>
          </div>
        ) : null}
      </div>
      {offspringChoice ? (
        <Sheet title="Use the Offspring Seal?" onClose={() => setOffspringChoice(null)}>
          <p className="eternal-offer">
            {(() => {
              const describe = (result: AutoResult | null) => {
                if (result?.plan) return counted(result.plan.sealCount, 'seal')
                if (result?.withEternal) return `${counted(result.withEternal.sealCount, 'seal')} and ${counted(result.withEternal.eternalSeals, 'Eternal Seal')}`
                return null
              }
              const sealed = describe(offspringChoice.withSeal)
              const unsealed = describe(offspringChoice.without)
              const level = ctx.start.child?.offspringLevel
              return sealed
                ? `The Offspring Seal starts the advanced class at Lv ${level}: that path needs ${sealed}. Promoting at Lv 1 instead leaves more level-ups and needs ${unsealed}.`
                : `The Offspring Seal starts the advanced class at Lv ${level}, too late to learn every equipped skill. Promoting at Lv 1 instead needs ${unsealed}.`
            })()}
          </p>
          <div className="eternal-offer-actions">
            {offspringChoice.withSeal?.plan || offspringChoice.withSeal?.withEternal ? (
              <button type="button" className="btn primary" onClick={() => { const result = offspringChoice.withSeal; setOffspringChoice(null); finish(result) }}>Use the Offspring Seal</button>
            ) : null}
            <button type="button" className="btn outline" onClick={() => { const result = offspringChoice.without; setOffspringChoice(null); finish(result) }}>Plan without it</button>
          </div>
        </Sheet>
      ) : null}
      {bookChoice ? (
        <Sheet title="Class or skill book?" onClose={() => setBookChoice(null)}>
          <p className="eternal-offer">These skills come from a class or from their skill book. Planning the class costs levels and maybe seals; the book costs the book.</p>
          <div className="book-choices">
            {bookChoice.skills.map((skillId) => {
              const book = bookChoice.book.includes(skillId)
              return (
                <div key={skillId} className="book-choice">
                  <SkillIcon skillId={skillId} name={dataset.skillsById.get(skillId)?.name ?? '?'} size={24} />
                  <span className="book-choice-name">{dataset.skillsById.get(skillId)?.name}</span>
                  <Segmented
                    label={`Learn ${dataset.skillsById.get(skillId)?.name} by`}
                    value={book ? 'book' : 'class'}
                    options={[{ id: 'class', label: 'Class' }, { id: 'book', label: 'Skill book' }]}
                    onChange={(next) => setBookChoice({ ...bookChoice, book: next === 'book' ? [...bookChoice.book, skillId] : bookChoice.book.filter((id) => id !== skillId) })}
                  />
                </div>
              )
            })}
          </div>
          <div className="eternal-offer-actions">
            <button type="button" className="btn primary" onClick={() => void plan(bookChoice.book)}>Plan</button>
            <button type="button" className="btn outline" onClick={() => setBookChoice(null)}>Cancel</button>
          </div>
        </Sheet>
      ) : null}
      {eternalOffer?.withEternal ? (
        <Sheet title="Use an Eternal Seal?" onClose={() => setEternalOffer(null)}>
          <p className="eternal-offer">
            {eternalOffer.withEternal.eternalSeals === 1 ? 'An Eternal Seal (+5 levels)' : `${eternalOffer.withEternal.eternalSeals} Eternal Seals (+5 levels each)`}
            {eternalOffer.plan
              ? ` would save ${savedSeals(dataset, eternalOffer.plan, eternalOffer.withEternal)}.`
              : ' would make room for every equipped skill; without, no path learns them all.'}
          </p>
          <div className="eternal-offer-actions">
            <button type="button" className="btn primary" onClick={() => { applyAuto(eternalOffer.withEternal!, eternalOffer); setEternalOffer(null) }}>
              Use {eternalOffer.withEternal.eternalSeals === 1 ? 'an Eternal Seal' : `${eternalOffer.withEternal.eternalSeals} Eternal Seals`}
            </button>
            <button type="button" className="btn outline" onClick={() => { if (eternalOffer.plan) applyAuto(eternalOffer.plan, eternalOffer); setEternalOffer(null) }}>
              {eternalOffer.plan ? 'Plan without' : 'Cancel'}
            </button>
          </div>
        </Sheet>
      ) : null}
    </>
  )
}

/** A seal kind's item name: "Heart Seal", or a DLC class's own item ("Dread Scroll"). */
function sealName(dataset: Dataset, kind: string): string {
  if (kind.startsWith('dlc:')) {
    const key = classItemKey(dataset, Number(kind.slice(4)))
    return key ? itemName(key) : 'class item'
  }
  const key = sealItemKey(kind)
  return key ? itemName(key) : kind
}

const counted = (count: number, name: string) => `${count} ${name}${count === 1 ? '' : 's'}`

/** "1 Heart Seal and 1 Master Seal": what the Eternal Seal plan needs fewer of. */
function savedSeals(dataset: Dataset, plan: AutoPlan, withEternal: AutoPlan): string {
  const parts = Object.entries(plan.seals)
    .map(([kind, count]) => [kind, count - (withEternal.seals[kind] ?? 0)] as const)
    .filter(([, saved]) => saved > 0)
    .map(([kind, saved]) => counted(saved, sealName(dataset, kind)))
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0] ?? `${plan.sealCount - withEternal.sealCount} seals`
}

/** The toast after automating: seals used, then any skill the path can't cover, and why. */
function autoSummary(dataset: Dataset, access: SkillAccessMap, result: AutoResult, plan: AutoPlan): string {
  const name = (id: number) => dataset.skillsById.get(id)?.name ?? '?'
  const why = (group: string) => result.unreachable.filter((id) => (access.byId.get(id)?.group ?? 'unavailable') === group)
  const list = (ids: number[], reason: string) => (ids.length ? `${ids.map(name).join(', ')} ${reason}` : null)
  const seals = plan.sealCount === 0 ? 'no seals' : Object.entries(plan.seals).map(([kind, count]) => counted(count, sealName(dataset, kind))).join(', ')
  const notes = [
    result.books.length ? `${result.books.map(name).join(', ')} from ${result.books.length === 1 ? 'its skill book' : 'their skill books'}` : null,
    list(why('locked'), 'need a support first'),
    list(why('inheritable'), 'can only be inherited'),
    list(why('unavailable'), "can't be learned"),
  ].filter(Boolean)
  return `Planned with ${seals}${plan.eternalSeals ? ` and ${counted(plan.eternalSeals, 'Eternal Seal')}` : ''}.${notes.length ? ` ${notes.join('; ')}.` : ''}`
}

/** In place of the access notice for a skill the page assumes its book teaches. */
function BookNotice({ skillId }: { skillId: number }) {
  const key = bookItemKey(skillId)
  return (
    <span className="skill-notice skill-notice-book" data-tone="grey">
      {key ? <ItemIcon itemKey={key} /> : null}
      <span>From its skill book (counted with the seals)</span>
    </span>
  )
}

function EquippedNotes({ ctx, items, label, childPicks, books = [] }: { ctx: UnitContext; items: SkillAccess[]; label: string; childPicks?: Map<number, UnitDef[]>; books?: number[] }) {
  const { dataset, run } = usePlanner()
  const names = (units: UnitDef[]) => units.map((unit) => displayName(unit, run)).join(' and ')
  return (
    <div className="skill-list" aria-label={label}>
      {items.map((item) => {
        const rules = skillRules(dataset, item.skillId, ctx.plan.skills)
        return (
          <SkillCard
            key={item.skillId}
            skill={skillView(dataset, item.skillId)}
            label={[
              ctx.plan.skills.includes(item.skillId) ? 'Equipped' : null,
              childPicks?.get(item.skillId) ? `Inherited by ${names(childPicks.get(item.skillId)!)}` : null,
            ].filter(Boolean).join(' · ') || undefined}
            tag={acquiredVia(dataset, run, ctx, item)}
            caution={rules.caution}
            notice={<>{books.includes(item.skillId) ? <BookNotice skillId={item.skillId} /> : <SkillNotice access={item} corrin={ctx.unit.isCorrin} />}<ConflictNotice names={rules.conflicts} /></>}
          />
        )
      })}
    </div>
  )
}

/** Only the parent's name carries the strong tag token; the rest of the line stays muted. */
function InheritCard({ dataset, skillId, parent, disabled, onClick }: { dataset: Dataset; skillId: number | undefined; parent: string | null; disabled: boolean; onClick(): void }) {
  const name = <strong className="skill-card-parent">{parent ?? 'Parent B'}</strong>
  return (
    <SkillCard
      skill={skillView(dataset, skillId)}
      disabled={disabled}
      emptyText={<>Tap to choose a skill from {name}</>}
      tag={skillId !== undefined ? <span className="skill-card-from">From {name}</span> : undefined}
      onClick={onClick}
    />
  )
}

function SkillChips({ dataset, skills }: { dataset: Dataset; skills: LearnedSkill[] }) {
  return skills.map((item) => {
    const name = dataset.skillsById.get(item.skillId)?.name ?? '?'
    return (
      <span key={item.skillId} className="learned-skill">
        <SkillIcon skillId={item.skillId} name={name} size={24} />
        {name}
      </span>
    )
  })
}

function LearnedLine({ dataset, row }: { dataset: Dataset; row: LevelRow }) {
  if (!row.learned.length) return <span className="level-learned" />
  return (
    <span className="level-learned">
      <SkillChips dataset={dataset} skills={row.learned} />
    </span>
  )
}

/**
 * Commits on blur/Enter, not per keystroke: a commit re-keys the field (keyed on the level), which
 * would remount it mid-typing. Out-of-range drafts snap back to the committed level.
 */
function JoinLevelField({ level, cap, disabled, onCommit }: { level: number; cap: number; disabled: boolean; onCommit(level: number): void }) {
  const [draft, setDraft] = useState(String(level))
  const commit = () => {
    const value = Number(draft)
    if (Number.isInteger(value) && value >= 1 && value <= cap && value !== level) onCommit(value)
    else setDraft(String(level))
  }
  return (
    <label className="join-level">
      <span>Lv</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={cap}
        value={draft}
        disabled={disabled}
        aria-label="Recruitment level"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
      />
    </label>
  )
}

/**
 * Children pick the main-story chapter their paralogue is done at (owner, v3.4): it sets their join
 * level and, from Chapter 19, the Offspring Seal's level. The earliest is the later parent's chapter.
 */
function JoinChapterField({ child, level, disabled, onChange }: { child: NonNullable<ClassStart['child']>; level: number; disabled: boolean; onChange(chapter: number): void }) {
  const chapters = Array.from({ length: child.final - child.earliest + 1 }, (_, index) => child.earliest + index)
  return (
    <div className="join-chapter">
      <span className="join-chapter-label" aria-hidden="true">Recruited chapter</span>
      <label className="reclass join-chapter-select" data-set="">
        <span className="visually-hidden">Recruited chapter</span>
        <select value={child.chapter} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))}>
          {chapters.map((chapter) => <option key={chapter} value={chapter}>Chapter {chapter}</option>)}
        </select>
        <Icon name="chevronDown" size={16} />
      </label>
      <span className="join-chapter-note">
        Lv {level}{child.offspringLevel ? ` · Offspring Seal → Advanced Lv ${child.offspringLevel}` : ''}
      </span>
    </div>
  )
}

function ReclassSelect({ dataset, row, first, disabled, onChange }: { dataset: Dataset; row: LevelRow; first: boolean; disabled: boolean; onChange(classId: number | null, seal?: 'offspring'): void }) {
  const name = (id: number) => classFamily(dataset.classesById.get(id)?.name ?? '?')
  if (first && row.reclass === null && row.options.length === 0) {
    return <span className="reclass locked">{name(row.classId)}</span>
  }
  return (
    <label className="reclass" data-set={row.reclass !== null ? '' : undefined}>
      <span className="visually-hidden">Reclass at level {row.level}</span>
      {/* Values carry the seal: an Offspring Seal and a Master Seal can promote into the same class. */}
      <select
        value={row.reclass === null ? '' : `${row.reclassSeal === 'offspring' ? 'o' : ''}${row.reclass}`}
        disabled={disabled}
        onChange={(event) => {
          const value = event.target.value
          if (value === '') onChange(null)
          else if (value.startsWith('o')) onChange(Number(value.slice(1)), 'offspring')
          else onChange(Number(value))
        }}
      >
        <option value="">{first ? name(row.classId) : 'No reclass'}</option>
        {SEAL_ORDER.map((seal) => {
          const options = row.options.filter((option) => option.seal === seal)
          if (!options.length) return null
          return (
            <optgroup key={seal} label={SEAL_LABEL[seal]}>
              {options.map((option) => (
                <option key={option.classId} value={`${seal === 'offspring' ? 'o' : ''}${option.classId}`}>
                  {name(option.classId)}{option.newSegment && option.level > 1 ? ` (Lv ${option.level})` : ''}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
      <Icon name="chevronDown" size={16} />
    </label>
  )
}
