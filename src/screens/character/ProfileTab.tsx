import type { ReactNode } from 'react'
import { usePickers } from '../../app/pickerStore'
import { usePlanner } from '../../app/plannerContext'
import { useUi } from '../../app/ui'
import { ClassSprite } from '../../components/art'
import { Icon } from '../../components/icons'
import { Rail, Segmented } from '../../components/controls'
import type { SlotKind } from '../../components/slots'
import { RelationCard, UnitLink } from '../../components/relations'
import { slotLabel } from '../../components/slots'
import { SkillCard } from '../../components/SkillCard'
import { StatTable } from '../../components/StatTable'
import type { Dataset, UnitDef } from '../../data/types'
import type { UnitContext } from '../../logic/army'
import { armyUnits, displayName, personalSkill } from '../../logic/army'
import { classFamily } from '../../logic/classes'
import { CLASS_CARD_LENSES, colourReferenceClassIds, lensDef, lensRow } from '../../logic/lenses'
import { setPairRole } from '../../logic/relationships'
import { sealGain, skillView, unitClassIds } from '../../app/unitViews'
import { emptyUnitPlan, SKILL_SLOTS } from '../../state/model'
import type { RunPlan } from '../../state/model'
import { navigate } from '../../lib/router'
import { compareRecruitOrder } from '../../app/selectors'

export function ProfileTab({ ctx }: { ctx: UnitContext }) {
  const { dataset, run, readOnly, mutate } = usePlanner()
  const { classLens, classFilter, setClassLens, setClassFilter } = useUi()
  const openPicker = usePickers((state) => state.open)
  const unitId = ctx.unit.id
  const person = (unit: UnitDef | undefined) => (unit ? { id: unit.id, name: displayName(unit) } : null)
  const role = ctx.plan.pairRole ?? 'front'

  // Corrin can't hold an A+ rank; the A slot lists planned A-rank Friendship Seal partners instead.
  const friendshipGains = [...new Set(ctx.pool
    .filter((entry) => entry.branch === 'aplus' && dataset.classesById.get(entry.classId)?.tier === 'base')
    .map((entry) => classFamily(dataset.classesById.get(entry.classId)!.name)))]
  const people = (...units: (UnitDef | undefined)[]) => units.flatMap((unit) => { const view = person(unit); return view ? [view] : [] })
  const relations: { kind: SlotKind; partners: { id: string; name: string }[]; caption: ReactNode }[] = [
    { kind: 's', partners: people(ctx.sPartner), caption: ctx.sPartner ? gainsCaption(sealGain(ctx, dataset, 'seal')) : null },
    ctx.unit.isCorrin
      ? { kind: 'a', partners: people(...ctx.friendshipPartners), caption: friendshipCaption(friendshipGains) }
      : { kind: 'a', partners: people(ctx.aPlusPartner), caption: ctx.aPlusPartner ? gainsCaption(sealGain(ctx, dataset, 'aplus')) : null },
  ]
  relations.push({
    kind: 'pair',
    partners: people(ctx.pairPartner),
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
  const openUnit = (id: string) => navigate({ name: 'unit', unitId: id, tab: 'profile' })
  // Quick links: a child's two parents, otherwise the unit's children on this roster.
  const family = ctx.isChild
    ? [dataset.unitsById.get(ctx.unit.fixedParent ?? ''), ctx.variableParent].filter((unit): unit is UnitDef => unit !== undefined)
    : childrenOnRoster(dataset, run, ctx)

  return (
    <>
      <section className="panel-section" aria-labelledby="rel-title">
        <h2 id="rel-title" className="section-title">Relationships</h2>
        <div className="rel-grid" data-count={relations.length}>
          {relations.map((item) => (
            <div key={item.kind} className="rel-col">
              <h3 className="sub-title">{slotLabel(item.kind, ctx.unit.isCorrin)}</h3>
              <div className="rel-card-wrap">
                <RelationCard kind={item.kind} partners={item.partners} corrin={ctx.unit.isCorrin} disabled={readOnly} onClick={() => openPicker({ character: { unitId, kind: item.kind } })} />
                {item.partners.length === 1 ? (
                  <button type="button" className="rel-open" aria-label={`Open ${item.partners[0].name}`} onClick={() => openUnit(item.partners[0].id)}>
                    <Icon name="openInNew" size={16} />
                  </button>
                ) : null}
              </div>
              <div className="rel-under">{item.caption}</div>
            </div>
          ))}
        </div>
        {family.length ? (
          <div className="family-links">
            <h3 className="sub-title">{ctx.isChild ? 'Parents' : 'Children'}</h3>
            {family.map((unit) => <UnitLink key={unit.id} unit={unit} onOpen={() => openUnit(unit.id)} />)}
          </div>
        ) : null}
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
                <StatTable
                  row={lensRow(dataset, run, ctx, lens.id, classId)}
                  signed={lens.signed}
                  inverse={selected}
                  label={`${def.name} ${lens.label}`}
                  referenceRows={colourReferenceClassIds(dataset, run, ctx, lens.id, classId, classIds).map((candidateId) => lensRow(dataset, run, ctx, lens.id, candidateId))}
                />
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel-section" aria-labelledby="skill-title">
        <h2 id="skill-title" className="section-title">Skills</h2>
        <div className="skill-list">
          <SkillCard skill={skillView(dataset, personal)} locked />
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

function childrenOnRoster(dataset: Dataset, run: RunPlan, ctx: UnitContext): UnitDef[] {
  const roster = new Set(armyUnits(dataset, run).map((unit) => unit.id))
  const spouse = ctx.plan.sPartner
  return dataset.units
    .filter((unit) => roster.has(unit.id) && unit.fixedParent !== null && (unit.fixedParent === ctx.unit.id || unit.fixedParent === spouse))
    .sort((a, b) => compareRecruitOrder(dataset, run, a, b))
}

/** One line only: several Friendship Seal classes collapse to "Gains multiple" (full list on hover / for AT). */
function friendshipCaption(classes: string[]) {
  if (classes.length <= 1) return gainsCaption(classes[0] ?? null)
  const all = classes.join(', ')
  return <span className="rel-caption" title={`Gains ${all}`} aria-label={`Gains ${all}`}>Gains multiple</span>
}

function gainsCaption(className: string | null) {
  return className ? <span className="rel-caption">Gains {className}</span> : null
}
