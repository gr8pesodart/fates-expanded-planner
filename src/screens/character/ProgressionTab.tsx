import { Fragment, useMemo, useState } from 'react'
import { usePickers } from '../../app/pickerStore'
import { usePlanner } from '../../app/plannerContext'
import { SkillIcon } from '../../components/art'
import { Icon } from '../../components/icons'
import { SkillCard } from '../../components/SkillCard'
import { StatTable } from '../../components/StatTable'
import { useToast } from '../../components/toast'
import type { Dataset } from '../../data/types'
import type { UnitContext } from '../../logic/army'
import { unitContext } from '../../logic/army'
import { classFamily } from '../../logic/classes'
import type { LearnedSkill, LevelRow, ReclassSeal } from '../../logic/progression'
import { buildProgression, tierCap, withReclass } from '../../logic/progression'
import type { Reclass, RunPlan } from '../../state/model'
import { emptyUnitPlan } from '../../state/model'
import { skillView } from '../../app/unitViews'

const SEAL_LABEL: Record<ReclassSeal, string> = {
  master: 'Master Seal',
  heart: 'Heart Seal',
  partner: 'Partner Seal',
  friendship: 'Friendship Seal',
  dlc: 'DLC',
}

const SEAL_ORDER: ReclassSeal[] = ['master', 'heart', 'partner', 'friendship', 'dlc']

function withUnitPlan(run: RunPlan, unitId: string, update: (plan: RunPlan['units'][string]) => RunPlan['units'][string]): RunPlan {
  return { ...run, units: { ...run.units, [unitId]: update(run.units[unitId] ?? emptyUnitPlan()) } }
}

export function ProgressionTab({ ctx }: { ctx: UnitContext }) {
  const { dataset, run, readOnly, mutate } = usePlanner()
  const showToast = useToast((state) => state.show)
  const openPicker = usePickers((state) => state.open)
  const [open, setOpen] = useState<string | null>(null)
  const progression = useMemo(() => buildProgression(dataset, run, ctx), [dataset, run, ctx])
  const unitId = ctx.unit.id

  const setReclass = (row: LevelRow, classId: number | null) => {
    const reclasses = withReclass(ctx.plan.reclasses, row.segment, row.level, classId)
    const nextRun = withUnitPlan(run, unitId, (plan) => ({ ...plan, reclasses }))
    const nextCtx = unitContext(dataset, nextRun, unitId)
    const dropped = nextCtx ? buildProgression(dataset, nextRun, nextCtx).dropped : []
    const kept: Reclass[] = reclasses.filter((item) => !dropped.includes(item))
    mutate((current) => withUnitPlan(current, unitId, (plan) => ({ ...plan, reclasses: kept })))
    if (dropped.length) showToast(`Removed ${dropped.length} later reclass${dropped.length === 1 ? '' : 'es'} that no longer fit.`)
  }

  const setEternal = (count: number) => mutate((current) => withUnitPlan(current, unitId, ({ eternalSeals: _old, ...plan }) => (
    count > 0 ? { ...plan, eternalSeals: count } : plan
  )))

  const last = progression.segments.at(-1)
  const lastRow = last?.rows.at(-1)
  const canEternal = last && last.tier !== 'base' && lastRow?.level === tierCap(last.tier, progression.eternalSeals)

  return (
    <>
      {ctx.isChild ? (
        <section className="panel-section" aria-labelledby="inherit-title">
          <h2 id="inherit-title" className="section-title">Inherited Skill</h2>
          <SkillCard
            skill={skillView(dataset, ctx.plan.inheritSkill)}
            disabled={readOnly}
            tag={ctx.variableParent ? `From ${ctx.variableParent.name.replace(/\s*\((M|F)\)$/, '')}` : 'Needs Parent B'}
            onClick={() => openPicker({ skill: { unitId, slot: 'inherit' } })}
          />
        </section>
      ) : null}
      {progression.segments.map((segment, segmentIndex) => (
        <section key={segmentIndex} className="panel-section progression" aria-label={segment.label}>
          <h2 className="section-title">{segment.label}</h2>
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
                    <ReclassSelect dataset={dataset} row={row} first={segmentIndex === 0 && row === segment.rows[0]} disabled={readOnly} onChange={(classId) => setReclass(row, classId)} />
                  </li>
                  {expanded ? (
                    <li className="level-info">
                      <div className="stat-block"><h3 className="sub-title">Expected Stats</h3><StatTable row={row.expected} inverse label="Expected stats" /></div>
                      <div className="stat-block"><h3 className="sub-title">Effective Growth Rate</h3><StatTable row={row.growths} inverse label="Effective growth rate" /></div>
                      <div className="stat-block"><h3 className="sub-title">Effective Pair Up Bonuses</h3><StatTable row={row.pairUp.map((value, index) => (index === 0 ? null : value))} signed inverse label="Effective pair up bonuses" /></div>
                    </li>
                  ) : null}
                </Fragment>
              )
            })}
          </ol>
        </section>
      ))}
      {canEternal || progression.eternalSeals > 0 ? (
        <div className="eternal-row">
          {canEternal ? <button type="button" className="btn outline" disabled={readOnly} onClick={() => setEternal(progression.eternalSeals + 1)}>Use Eternal Seal (+5 levels)</button> : null}
          {progression.eternalSeals > 0 ? <button type="button" className="text-btn" disabled={readOnly} onClick={() => setEternal(progression.eternalSeals - 1)}>Remove an Eternal Seal</button> : null}
        </div>
      ) : null}
    </>
  )
}

function LearnedLine({ dataset, row }: { dataset: Dataset; row: LevelRow }) {
  const groups: [string, LearnedSkill[]][] = []
  if (row.startsWith.length) groups.push(['Starts with', row.startsWith])
  const levelled = row.learned.filter((item) => !item.onReclass)
  const onReclass = row.learned.filter((item) => item.onReclass)
  if (levelled.length) groups.push(['Learns', levelled])
  if (onReclass.length) groups.push([levelled.length ? '+' : 'Learns', onReclass])
  if (!groups.length) return <span className="level-learned" />
  return (
    <span className="level-learned">
      {groups.map(([label, skills]) => (
        <Fragment key={label}>
          <em className="muted">{label}</em>
          {skills.map((item) => {
            const name = dataset.skillsById.get(item.skillId)?.name ?? '?'
            return (
              <span key={item.skillId} className="learned-skill">
                <SkillIcon skillId={item.skillId} name={name} size={16} />
                {name}
              </span>
            )
          })}
        </Fragment>
      ))}
    </span>
  )
}

function ReclassSelect({ dataset, row, first, disabled, onChange }: { dataset: Dataset; row: LevelRow; first: boolean; disabled: boolean; onChange(classId: number | null): void }) {
  const name = (id: number) => classFamily(dataset.classesById.get(id)?.name ?? '?')
  if (first && row.reclass === null && row.options.length === 0) {
    return <span className="reclass locked">{name(row.classId)}</span>
  }
  return (
    <label className="reclass" data-set={row.reclass !== null ? '' : undefined}>
      <span className="visually-hidden">Reclass at level {row.level}</span>
      <select
        value={row.reclass ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      >
        <option value="">{first ? name(row.classId) : 'No reclass'}</option>
        {SEAL_ORDER.map((seal) => {
          const options = row.options.filter((option) => option.seal === seal)
          if (!options.length) return null
          return (
            <optgroup key={seal} label={SEAL_LABEL[seal]}>
              {options.map((option) => (
                <option key={option.classId} value={option.classId}>
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
