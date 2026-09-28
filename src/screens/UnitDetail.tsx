import { useMemo, useState } from 'react'
import { StatGrid } from '../components/StatGrid'
import { skillName, type Dataset, type UnitDef } from '../data/types'
import { classPool, type ClassPoolEntry } from '../logic/classes'
import { childrenOfPair, fixedParentOf } from '../logic/family'
import { MAX_EQUIPPED_SKILLS, skillPool } from '../logic/skills'
import { fixedParentIsCorrin, projectUnit } from '../logic/stats'
import { usePlansStore, type Plan, type PlanUnit } from '../state/plansStore'

interface UnitDetailProps {
  plan: Plan
  dataset: Dataset
  planUnit: PlanUnit
  onBack: () => void
  onRemove: () => void
}

type StatView = 'stats' | 'growths' | 'caps'

export function UnitDetail({ plan, dataset, planUnit, onBack, onRemove }: UnitDetailProps) {
  const updateUnit = usePlansStore((s) => s.updateUnit)
  const unit = dataset.unitsById.get(planUnit.characterId)
  const [statView, setStatView] = useState<StatView>('stats')
  const [skillQuery, setSkillQuery] = useState('')

  const sPartner = planUnit.sPartnerId ? dataset.unitsById.get(planUnit.sPartnerId) : undefined
  const aPlus = planUnit.aPlusPartnerId
    ? dataset.unitsById.get(planUnit.aPlusPartnerId)
    : undefined
  const variableParent = planUnit.variableParentId
    ? dataset.unitsById.get(planUnit.variableParentId)
    : undefined

  const pool = useMemo(() => {
    if (!unit) return []
    return classPool(dataset, unit, {
      variableParent,
      sPartner,
      aPlusPartner: aPlus,
      corrinTalentClassId: plan.corrin.talentClassId ?? null,
      fixedParentIsCorrin: fixedParentIsCorrin(dataset, unit),
    })
  }, [dataset, unit, variableParent, sPartner, aPlus, plan.corrin.talentClassId])

  const skills = useMemo(() => {
    if (!unit) return []
    return skillPool(dataset, unit, pool, plan.route)
  }, [dataset, unit, pool, plan.route])

  if (!unit) {
    return (
      <section className="card">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
          ‹ Back
        </button>
        <div className="empty" style={{ marginTop: 12 }}>
          Unit not found in the dataset.
        </div>
      </section>
    )
  }

  const projection = projectUnit(dataset, unit, planUnit.classId, {
    corrinBoon: unit.isCorrin ? plan.corrin.boon : undefined,
    corrinBane: unit.isCorrin ? plan.corrin.bane : undefined,
    variableParentId: planUnit.variableParentId ?? undefined,
  })

  const equipped = planUnit.skills ?? []
  const poolIds = new Set(skills.map((s) => s.skillId))
  const classDef = planUnit.classId !== undefined ? dataset.classesById.get(planUnit.classId) : undefined
  const fixedParent = fixedParentOf(dataset, unit)

  const romanticEdges = dataset.edgesByCharacter.get(unit.id) ?? []
  const partnerOf = (edge: (typeof romanticEdges)[number]) =>
    dataset.unitsById.get(edge.a === unit.id ? edge.b : edge.a)

  const sCandidates = romanticEdges
    .filter((e) => e.info.kind === 'romantic')
    .map(partnerOf)
    .filter((u): u is UnitDef => u !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name))

  const aPlusCandidates = romanticEdges
    .filter((e) => e.info.ranks.a !== null)
    .map(partnerOf)
    .filter((u): u is UnitDef => u !== undefined)
    .filter((u) => u.gender === unit.gender && u.id !== planUnit.sPartnerId)
    .sort((a, b) => a.name.localeCompare(b.name))

  const variableParentCandidates = fixedParent
    ? (dataset.edgesByCharacter.get(fixedParent.id) ?? [])
        .filter((e) => e.info.kind === 'romantic')
        .map((e) => dataset.unitsById.get(e.a === fixedParent.id ? e.b : e.a))
        .filter((u): u is UnitDef => u !== undefined)
        .filter((u) => u.id !== unit.id)
        .sort((a, b) => a.name.localeCompare(b.name))
    : []

  const pairChildren = planUnit.sPartnerId ? childrenOfPair(dataset, unit.id, planUnit.sPartnerId) : []

  const grouped = new Map<string, ClassPoolEntry[]>()
  for (const entry of pool) {
    const list = grouped.get(entry.sourceLabel)
    if (list) list.push(entry)
    else grouped.set(entry.sourceLabel, [entry])
  }

  const toggleSkill = (skillId: number) => {
    const next = equipped.includes(skillId)
      ? equipped.filter((id) => id !== skillId)
      : [...equipped, skillId].slice(0, MAX_EQUIPPED_SKILLS)
    updateUnit(plan.id, planUnit.id, { skills: next })
  }

  const filteredSkills = skills.filter((entry) =>
    skillQuery.trim() === ''
      ? true
      : skillName(dataset, entry.skillId).toLowerCase().includes(skillQuery.toLowerCase()),
  )

  return (
    <>
      <section className="card">
        <div className="detailhead">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
            ‹ Army
          </button>
          <div className="detailhead__name">
            <h2 style={{ margin: 0 }}>{unit.name}</h2>
            <span className="meta">
              {unit.gender === 'female' ? 'Female' : 'Male'}
              {fixedParent ? ` · child of ${fixedParent.name}` : ''}
              {unit.isCorrin ? ' · Avatar' : ''}
            </span>
          </div>
          <button type="button" className="btn btn--danger btn--sm" onClick={onRemove}>
            Remove
          </button>
        </div>
      </section>

      {fixedParent && (
        <section className="card">
          <h2>Parents</h2>
          <div className="statline">
            <span className="k">Fixed parent</span>
            <span className="v">{fixedParent.name}</span>
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor="var-parent">
              {fixedParentIsCorrin(dataset, unit) ? 'Other parent (Corrin’s spouse)' : 'Second parent'}
            </label>
            <select
              id="var-parent"
              value={planUnit.variableParentId ?? ''}
              onChange={(e) =>
                updateUnit(plan.id, planUnit.id, {
                  variableParentId: e.target.value || undefined,
                })
              }
            >
              <option value="">— choose —</option>
              {variableParentCandidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>
            Growths are averaged with the second parent; cap modifiers are the two parents’ mods
            combined (Fates rules). Class options include both parents’ branches.
          </p>
        </section>
      )}

      <section className="card">
        <h2>Class</h2>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="unit-class">Planned class</label>
          <select
            id="unit-class"
            value={planUnit.classId ?? ''}
            onChange={(e) =>
              updateUnit(plan.id, planUnit.id, {
                classId: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          >
            <option value="">— none —</option>
            {[...grouped.entries()].map(([label, entries]) => (
              <optgroup key={label} label={label}>
                {entries.map((entry) => {
                  const cls = dataset.classesById.get(entry.classId)
                  if (!cls) return null
                  return (
                    <option key={entry.classId} value={entry.classId}>
                      {cls.name}
                      {cls.tier === 'promoted' ? ' ★' : ''}
                    </option>
                  )
                })}
              </optgroup>
            ))}
          </select>
        </div>
        {classDef && (
          <>
            <div className="statline" style={{ marginTop: 10 }}>
              <span className="k">Tier</span>
              <span className="v">
                {classDef.tier === 'promoted' ? 'Promoted ★' : classDef.tier === 'base' ? 'Base' : 'Special'}
                {' · '}
                Mov {classDef.movement}
              </span>
            </div>
            <div className="statline">
              <span className="k">Learns</span>
              <span className="v">
                {classDef.skills.map((id) => skillName(dataset, id)).join(', ') || '—'}
              </span>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2>Stats</h2>
        <div className="seg" role="group" aria-label="Stat view" style={{ marginBottom: 12 }}>
          {(
            [
              ['stats', 'Stats'],
              ['growths', 'Growths'],
              ['caps', 'Caps'],
            ] as Array<[StatView, string]>
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={statView === id} onClick={() => setStatView(id)}>
              {label}
            </button>
          ))}
        </div>
        {statView === 'stats' && <StatGrid values={projection.stats} />}
        {statView === 'growths' && <StatGrid values={projection.growths} suffix="%" emphasizeMax />}
        {statView === 'caps' && <StatGrid values={projection.caps} />}
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          {statView === 'stats' && 'Personal base stats + class base stats.'}
          {statView === 'growths' &&
            (unit.isCorrin
              ? 'Personal growths with boon/bane + class growths.'
              : projection.childAveraged
                ? 'Child growths averaged with the second parent + class growths.'
                : 'Personal growths + class growths.')}
          {statView === 'caps' &&
            'Class caps + personal cap modifiers (parents combine for children).'}
        </p>
      </section>

      <section className="card">
        <h2>Skills ({equipped.length}/{MAX_EQUIPPED_SKILLS})</h2>
        {equipped.length === 0 ? (
          <div className="empty">No skills equipped. Pick from the list below.</div>
        ) : (
          <div className="chiprow" style={{ marginBottom: 12 }}>
            {equipped.map((id) => (
              <button
                key={id}
                type="button"
                className={`chip ${poolIds.has(id) ? 'chip--gold' : 'chip--muted'}`}
                title={poolIds.has(id) ? 'Remove' : 'Not available with the current classes'}
                onClick={() => toggleSkill(id)}
              >
                {skillName(dataset, id)} ✕
              </button>
            ))}
          </div>
        )}
        <div className="field">
          <label htmlFor="skill-search">Available skills</label>
          <input
            id="skill-search"
            value={skillQuery}
            onChange={(e) => setSkillQuery(e.target.value)}
            placeholder="Filter…"
          />
        </div>
        <div className="stack">
          {filteredSkills.map((entry) => {
            const equippedNow = equipped.includes(entry.skillId)
            const full = equipped.length >= MAX_EQUIPPED_SKILLS && !equippedNow
            return (
              <div className="rowitem" key={`${entry.source}-${entry.skillId}`}>
                <div className="grow">
                  <div className="name">{skillName(dataset, entry.skillId)}</div>
                  <div className="meta">{entry.label}</div>
                </div>
                <button
                  type="button"
                  className={`btn btn--sm ${equippedNow ? 'btn--ghost' : ''}`}
                  disabled={full}
                  onClick={() => toggleSkill(entry.skillId)}
                >
                  {equippedNow ? 'Unequip' : 'Equip'}
                </button>
              </div>
            )
          })}
          {filteredSkills.length === 0 && <div className="empty">No matching skills.</div>}
        </div>
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Pool = personal skill + every class you can reclass into (including parent and partner
          seal classes).
        </p>
      </section>

      <section className="card">
        <h2>Support</h2>
        <div className="field">
          <label htmlFor="s-partner">S rank (marriage)</label>
          <select
            id="s-partner"
            value={planUnit.sPartnerId ?? ''}
            onChange={(e) =>
              updateUnit(plan.id, planUnit.id, { sPartnerId: e.target.value || undefined })
            }
          >
            <option value="">— none —</option>
            {sCandidates.map((u) => {
              const kids = childrenOfPair(dataset, unit.id, u.id)
              return (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {kids.length > 0 ? ` → ${kids.map((k) => k.name).join(' + ')}` : ''}
                </option>
              )
            })}
          </select>
        </div>
        <div className="field">
          <label htmlFor="aplus-partner">A+ rank (friendship seal)</label>
          <select
            id="aplus-partner"
            value={planUnit.aPlusPartnerId ?? ''}
            onChange={(e) =>
              updateUnit(plan.id, planUnit.id, { aPlusPartnerId: e.target.value || undefined })
            }
          >
            <option value="">— none —</option>
            {aPlusCandidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        {pairChildren.length > 0 && (
          <div className="chiprow">
            {pairChildren.map((child) => (
              <span className="chip chip--ok" key={child.id}>
                Child: {child.name}
              </span>
            ))}
          </div>
        )}
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Candidates come from the modded support graph (UGF expands nearly everyone). A+ options
          are approximated as same-gender A-rank partners.
        </p>
      </section>
    </>
  )
}
