import { useState } from 'react'
import { usePlanner } from '../../app/plannerContext'
import { Rail } from '../../components/controls'
import { StatTable } from '../../components/StatTable'
import type { UnitContext } from '../../logic/army'
import { classFamily } from '../../logic/classes'
import type { LensId } from '../../logic/lenses'
import { colourReferenceClassIds, lensDef, lensRow } from '../../logic/lenses'
import { unitClassIds } from '../../app/unitViews'
import { armyUnits, unitContext } from '../../logic/army'

const GROUPS: { title: string; lenses: LensId[]; perClass?: boolean }[] = [
  { title: 'Effective', lenses: ['maxStats', 'effectiveGrowths', 'effectivePairUp'] },
  { title: 'Personal', lenses: ['statModifiers', 'personalGrowths', 'personalPairUp'] },
  { title: 'Class', lenses: ['baseStats', 'classGrowths', 'classPairUp'], perClass: true },
]

export function StatsTab({ ctx }: { ctx: UnitContext }) {
  const { dataset, run } = usePlanner()
  const [picked, setPicked] = useState<number | null>(null)
  const classIds = unitClassIds(dataset, ctx, run.dlc)
  const classId = picked !== null && classIds.includes(picked) ? picked : ctx.currentClassId
  const rosterContexts = armyUnits(dataset, run).flatMap((unit) => {
    const unitCtx = unitContext(dataset, run, unit.id)
    return unitCtx ? [unitCtx] : []
  })
  return (
    <>
      {GROUPS.map((group) => (
        <section key={group.title} className="panel-section" aria-label={group.title}>
          <h2 className="section-title">{group.title}</h2>
          {group.perClass ? (
            <Rail<number>
              variant="pills"
              label="Class"
              items={classIds.map((id) => ({ id, label: classFamily(dataset.classesById.get(id)?.name ?? '?') }))}
              active={classId}
              onSelect={setPicked}
            />
          ) : null}
          {group.lenses.map((id) => {
            const lens = lensDef(id)
            const activeClass = group.perClass ? classId : ctx.currentClassId
            const row = lensRow(dataset, run, ctx, id, activeClass)
            const referenceRows = group.title === 'Personal'
              ? rosterContexts.map((unitCtx) => lensRow(dataset, run, unitCtx, id))
              : colourReferenceClassIds(dataset, run, ctx, id, activeClass, classIds).map((candidateId) => lensRow(dataset, run, ctx, id, candidateId))
            return (
              <div key={id} className="stat-block">
                <h3 className="sub-title">{lens.label.replace(/ \((Personal|Class|Effective)\)/, '')}</h3>
                <StatTable row={row} signed={lens.signed} label={lens.label} referenceRows={referenceRows} />
              </div>
            )
          })}
        </section>
      ))}
    </>
  )
}
