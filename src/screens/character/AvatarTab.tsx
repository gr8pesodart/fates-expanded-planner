import { usePlanner } from '../../app/plannerContext'
import { ClassSprite, Portrait } from '../../components/art'
import { BANES, BOONS } from '../../data/boons'
import { splashArt } from '../../data/art'
import { STAT_KEYS, STAT_LABELS } from '../../data/types'
import type { StatKey } from '../../data/types'
import { talentOptions } from '../../logic/army'
import { classFamily } from '../../logic/classes'
import { switchCorrinGender } from '../../logic/relationships'
import type { RunPlan } from '../../state/model'

/** Corrin's creation choices; the new-run flow passes a draft `run` and `onChange`. */
export function AvatarTab({ run: override, onChange }: { run?: RunPlan; onChange?: (run: RunPlan) => void } = {}) {
  const planner = usePlanner()
  const { dataset, readOnly } = planner
  const run = override ?? planner.run
  const apply = (transform: (next: RunPlan) => RunPlan) => (onChange ? onChange(transform(run)) : planner.mutate(transform))
  const corrin = run.corrin
  const corrinUnit = (gender: 'male' | 'female') => dataset.units.find((unit) => unit.isCorrin && unit.gender === gender)
  const setCorrin = (patch: Partial<RunPlan['corrin']>) => apply((next) => ({ ...next, corrin: { ...next.corrin, ...patch } }))
  const talents = talentOptions(dataset, corrin.gender)
  const unitId = corrinUnit(corrin.gender)?.id ?? null

  return (
    <>
      <section className="panel-section tight" aria-labelledby="gender-title">
        <h2 id="gender-title" className="sub-title">Gender</h2>
        <div className="gender-grid" role="radiogroup" aria-labelledby="gender-title">
          {(['female', 'male'] as const).map((gender) => {
            const unit = corrinUnit(gender)
            const art = unit ? splashArt(unit.id) : null
            return (
              <button
                key={gender}
                type="button"
                role="radio"
                aria-checked={corrin.gender === gender}
                className="gender-card"
                disabled={readOnly}
                onClick={() => apply((next) => switchCorrinGender(dataset, next, gender))}
              >
                {art ? (
                  <img className="gender-art" src={art.src} alt="" style={{ objectPosition: `${art.focal.x * 100}% ${art.focal.y * 100}%` }} />
                ) : unit ? (
                  <Portrait unitId={unit.id} name="Corrin" crop="bust" className="gender-art" />
                ) : null}
                <span className="gender-label">{gender === 'female' ? 'Female' : 'Male'}</span>
              </button>
            )
          })}
        </div>
      </section>

      <StatChoice
        title="Boon"
        tone="good"
        value={corrin.boon}
        blocked={corrin.bane}
        labels={(key) => BOONS[key].label}
        disabled={readOnly}
        onPick={(boon) => setCorrin({ boon })}
      />
      <StatChoice
        title="Bane"
        tone="bad"
        value={corrin.bane}
        blocked={corrin.boon}
        labels={(key) => BANES[key].label}
        disabled={readOnly}
        onPick={(bane) => setCorrin({ bane })}
      />

      <section className="panel-section tight" aria-labelledby="talent-title">
        <h2 id="talent-title" className="sub-title">Talent</h2>
        <div className="talent-rail" role="radiogroup" aria-labelledby="talent-title">
          {talents.map((classId) => {
            const def = dataset.classesById.get(classId)
            if (!def) return null
            const tree = [classId, ...def.promotesTo]
            return (
              <button
                key={classId}
                type="button"
                role="radio"
                aria-checked={corrin.talentClassId === classId}
                className="talent-card"
                disabled={readOnly}
                onClick={() => setCorrin({ talentClassId: classId })}
              >
                <span className="talent-sprites">
                  {tree.map((id) => (
                    <ClassSprite key={id} unitId={unitId} classId={id} name={dataset.classesById.get(id)?.name ?? ''} size={32} />
                  ))}
                </span>
                <span className="talent-name">{classFamily(def.name)}</span>
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}

function StatChoice({ title, tone, value, blocked, labels, disabled, onPick }: {
  title: string
  tone: 'good' | 'bad'
  value: StatKey
  blocked: StatKey
  labels(key: StatKey): string
  disabled: boolean
  onPick(key: StatKey): void
}) {
  const id = `${title.toLowerCase()}-title`
  return (
    <section className="panel-section tight" aria-labelledby={id}>
      <h2 id={id} className="sub-title">{title}</h2>
      <div className="stat-choice" data-tone={tone} role="radiogroup" aria-labelledby={id}>
        {STAT_KEYS.map((key) => (
          <button key={key} type="button" role="radio" aria-checked={value === key} disabled={disabled || key === blocked} onClick={() => onPick(key)}>
            <span>{labels(key)}</span>
            <span>({STAT_LABELS[key]})</span>
          </button>
        ))}
      </div>
    </section>
  )
}
