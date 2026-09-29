import type { ReactNode } from 'react'
import { usePickers } from '../../app/pickerStore'
import { usePlanner } from '../../app/plannerContext'
import { useUi } from '../../app/ui'
import { ClassSprite } from '../../components/art'
import { Rail, Segmented } from '../../components/controls'
import type { SlotKind } from '../../components/slots'
import { RelationCard } from '../../components/relations'
import { SLOT_LABEL } from '../../components/slots'
import { SkillCard } from '../../components/SkillCard'
import { StatTable } from '../../components/StatTable'
import type { UnitDef } from '../../data/types'
import type { UnitContext } from '../../logic/army'
import { displayName, personalSkill } from '../../logic/army'
import { classFamily } from '../../logic/classes'
import { CLASS_CARD_LENSES, lensDef, lensRow } from '../../logic/lenses'
import { setPairRole } from '../../logic/relationships'
import { sealGain, skillView, unitClassIds } from '../../app/unitViews'
import { emptyUnitPlan, SKILL_SLOTS } from '../../state/model'

export function ProfileTab({ ctx }: { ctx: UnitContext }) {
  const { dataset, run, readOnly, mutate } = usePlanner()
  const { classLens, classFilter, setClassLens, setClassFilter } = useUi()
  const openPicker = usePickers((state) => state.open)
  const unitId = ctx.unit.id
  const person = (unit: UnitDef | undefined) => (unit ? { id: unit.id, name: displayName(unit) } : null)
  const role = ctx.plan.pairRole ?? 'front'

  const relations: { kind: SlotKind; partner: ReturnType<typeof person>; caption: ReactNode }[] = [
    { kind: 's', partner: person(ctx.sPartner), caption: ctx.sPartner ? gainsCaption(sealGain(ctx, dataset, 'seal')) : null },
    { kind: 'a', partner: person(ctx.aPlusPartner), caption: ctx.aPlusPartner ? gainsCaption(sealGain(ctx, dataset, 'aplus')) : null },
  ]
  if (ctx.isChild) {
    const fixed = ctx.unit.fixedParent ? dataset.unitsById.get(ctx.unit.fixedParent) : undefined
    relations.push({ kind: 'parent', partner: person(ctx.variableParent), caption: fixed ? <span className="rel-caption">with {displayName(fixed)}</span> : null })
  }
  relations.push({
    kind: 'pair',
    partner: person(ctx.pairPartner),
    caption: ctx.pairPartner ? (
      <Segmented
        label="Pair up position"
        value={role}
        disabled={readOnly}
        options={[{ id: 'front', label: 'Front' }, { id: 'back', label: 'Back' }]}
        onChange={(next) => mutate((runPlan) => setPairRole(runPlan, unitId, next))}
      />
    ) : null,
  })

  const classIds = unitClassIds(dataset, ctx, run.dlc).filter((id) => {
    const tier = dataset.classesById.get(id)?.tier
    if (classFilter === 'all') return true
    return classFilter === 'base' ? tier === 'base' : tier !== 'base'
  })
  const lens = lensDef(classLens)
  const chooseClass = (classId: number) => mutate((next) => ({
    ...next,
    units: { ...next.units, [unitId]: { ...(next.units[unitId] ?? emptyUnitPlan()), classId } },
  }))
  const personal = personalSkill(ctx.unit, run)

  return (
    <>
      <section className="panel-section" aria-labelledby="rel-title">
        <h2 id="rel-title" className="section-title">Relationships</h2>
        <div className="rel-grid" data-count={relations.length}>
          {relations.map((item) => (
            <div key={item.kind} className="rel-col">
              <h3 className="sub-title">{SLOT_LABEL[item.kind]}</h3>
              <RelationCard kind={item.kind} partner={item.partner} disabled={readOnly} onClick={() => openPicker({ character: { unitId, kind: item.kind } })} />
              <div className="rel-under">{item.caption}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-section" aria-labelledby="class-title">
        <div className="section-head">
          <h2 id="class-title" className="section-title">Classes</h2>
          <Segmented
            label="Class tier"
            value={classFilter}
            options={[{ id: 'base', label: 'Base' }, { id: 'promoted', label: 'Advanced' }, { id: 'all', label: 'All' }]}
            onChange={setClassFilter}
          />
        </div>
        <Rail
          variant="pills"
          label="Class stats shown"
          items={CLASS_CARD_LENSES.map((id) => ({ id, label: lensDef(id).label }))}
          active={CLASS_CARD_LENSES.includes(classLens) ? classLens : 'baseStats'}
          onSelect={setClassLens}
        />
        <div className="class-cards">
          {classIds.map((classId) => {
            const def = dataset.classesById.get(classId)
            if (!def) return null
            const selected = classId === ctx.currentClassId
            return (
              <button key={classId} type="button" className="class-card" aria-pressed={selected} disabled={readOnly} onClick={() => chooseClass(classId)}>
                <span className="class-card-head">
                  <ClassSprite unitId={unitId} classId={classId} name={def.name} size={32} />
                  <span className="class-card-name">{classFamily(def.name)}</span>
                  {selected ? <span className="class-card-tag">Selected</span> : null}
                </span>
                <StatTable row={lensRow(dataset, run, ctx, lens.id, classId)} signed={lens.signed} inverse={selected} label={`${def.name} ${lens.label}`} />
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel-section" aria-labelledby="skill-title">
        <h2 id="skill-title" className="section-title">Skills</h2>
        <div className="skill-list">
          <SkillCard skill={skillView(dataset, personal)} locked tag="Personal skill" />
          {Array.from({ length: SKILL_SLOTS }, (_, slot) => (
            <SkillCard
              key={slot}
              skill={skillView(dataset, ctx.plan.skills[slot])}
              disabled={readOnly}
              onClick={() => openPicker({ skill: { unitId, slot } })}
            />
          ))}
        </div>
      </section>
    </>
  )
}

function gainsCaption(className: string | null) {
  return className ? <span className="rel-caption">Gains {className}</span> : null
}
