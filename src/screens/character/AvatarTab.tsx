import { useCallback, useState } from 'react'
import { usePlanner } from '../../app/plannerContext'
import { ClassSprite, Portrait } from '../../components/art'
import { Icon } from '../../components/icons'
import { Sheet } from '../../components/Sheet'
import { CORRIN_HAIR_COLOURS } from '../../data/hairColours'
import { BANES, BOONS } from '../../data/boons'
import { STAT_KEYS, STAT_LABELS } from '../../data/types'
import type { StatKey } from '../../data/types'
import { classStart, talentOptions } from '../../logic/army'
import { corrinHairColour } from '../../logic/hair'
import { classFamily } from '../../logic/classes'
import { corrinPair, switchCorrinGender } from '../../logic/corrin'
import { navigate } from '../../lib/router'
import { corrinBuild, withCorrinBuild } from '../../state/model'
import type { CorrinBuild, Gender, RunPlan } from '../../state/model'

/** Corrin's creation choices; the new-run flow passes a draft `run` and `onChange`. */
export function AvatarTab({ run: override, onChange }: { run?: RunPlan; onChange?: (run: RunPlan) => void } = {}) {
  const planner = usePlanner()
  const { dataset, readOnly } = planner
  const run = override ?? planner.run
  const apply = (transform: (next: RunPlan) => RunPlan) => (onChange ? onChange(transform(run)) : planner.mutate(transform))
  const corrin = run.corrin
  const build = corrinBuild(run)
  const setBuild = (patch: Partial<CorrinBuild>) => apply((next) => withCorrinBuild(next, patch))
  const talents = talentOptions(dataset, corrin.gender)
  const hairColour = corrinHairColour(run)
  const corrinUnit = corrinPair(dataset, corrin.gender).corrin
  const unitId = corrinUnit?.id ?? null
  const switchTo = (gender: Gender) => {
    apply((next) => switchCorrinGender(dataset, next, gender))
    // The page follows the active Corrin (same screen instance, so the splash cross-fades).
    const target = corrinPair(dataset, gender).corrin
    if (!onChange && target) navigate({ name: 'unit', unitId: target.id, tab: 'avatar' }, { replace: true })
  }
  // Picking the stat held by the other choice swaps them (+Spd/-Lck, pick +Lck → -Spd).
  const pickBoon = (boon: StatKey) => setBuild(boon === build.bane ? { boon, bane: build.boon } : { boon })
  const pickBane = (bane: StatKey) => setBuild(bane === build.boon ? { bane, boon: build.bane } : { bane })

  return (
    <>
      <section className="panel-section tight" aria-labelledby="gender-title">
        <h2 id="gender-title" className="sub-title">Gender</h2>
        <div className="gender-grid" role="radiogroup" aria-labelledby="gender-title">
          {(['female', 'male'] as const).map((gender) => {
            const unit = corrinPair(dataset, gender).corrin
            return (
              <button
                key={gender}
                type="button"
                role="radio"
                aria-checked={corrin.gender === gender}
                className="gender-card"
                disabled={readOnly}
                onClick={() => switchTo(gender)}
              >
                {/* The bust portrait, not the splash: it carries Corrin's tinted hair. */}
                {unit ? <Portrait unitId={unit.id} name="Corrin" crop="bust" className="gender-art" run={run} hair={hairColour} /> : null}
                <span className="gender-label">{gender === 'female' ? 'Female' : 'Male'}</span>
              </button>
            )
          })}
        </div>
      </section>

      <NameField key={corrin.name ?? ''} name={corrin.name ?? ''} disabled={readOnly} onCommit={(name) => apply((next) => ({ ...next, corrin: { ...next.corrin, name: name.trim() || undefined } }))} />

      <HairColourRow colour={hairColour} unitId={unitId} classId={corrinUnit ? classStart(dataset, run, corrinUnit).classId : null} run={run} disabled={readOnly} onPick={(picked) => apply((next) => ({ ...next, corrin: { ...next.corrin, hairColour: picked } }))} />

      <StatChoice title="Boon" tone="good" value={build.boon} blocked={build.bane} labels={(key) => BOONS[key].label} disabled={readOnly} onPick={pickBoon} />
      <StatChoice title="Bane" tone="bad" value={build.bane} blocked={build.boon} labels={(key) => BANES[key].label} disabled={readOnly} onPick={pickBane} />

      <section className="panel-section tight" aria-labelledby="talent-title">
        <h2 id="talent-title" className="sub-title">Talent</h2>
        <div className="talent-rail" role="radiogroup" aria-labelledby="talent-title" data-swipe-ignore>
          {talents.map((classId) => {
            const def = dataset.classesById.get(classId)
            if (!def) return null
            const tree = [classId, ...def.promotesTo]
            return (
              <button
                key={classId}
                type="button"
                role="radio"
                aria-checked={build.talentClassId === classId}
                className="talent-card"
                disabled={readOnly}
                onClick={() => setBuild({ talentClassId: classId })}
              >
                <span className="talent-sprites">
                  {tree.map((id) => (
                    <ClassSprite key={id} unitId={unitId} classId={id} name={dataset.classesById.get(id)?.name ?? ''} size={32} hair={hairColour} run={run} />
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

/**
 * Commits on blur/Enter: the name shows across every mounted tab and list, so a store write per
 * keystroke would re-render the whole page while typing.
 */
function NameField({ name, disabled, onCommit }: { name: string; disabled: boolean; onCommit(name: string): void }) {
  const [draft, setDraft] = useState(name)
  return (
    <section className="panel-section tight" aria-labelledby="name-title">
      <label className="field">
        <span id="name-title" className="sub-title">Name</span>
        <input
          value={draft}
          placeholder="Corrin"
          maxLength={16}
          disabled={disabled}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => { if (draft.trim() !== name.trim()) onCommit(draft) }}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
        />
      </label>
    </section>
  )
}

/** Corrin's hair: a row showing the current swatch; tapping opens the game's 30 swatches. */
function HairColourRow({ colour, unitId, classId, run, disabled, onPick }: { colour: string; unitId: string | null; classId: number | null; run: RunPlan; disabled: boolean; onPick(colour: string): void }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  // Stays open so the preview sprite can be compared across swatches.
  const pick = (next: string) => onPick(next)
  const index = CORRIN_HAIR_COLOURS.indexOf(colour)
  return (
    <section className="panel-section tight" aria-labelledby="hair-title">
      <h2 id="hair-title" className="sub-title">Hair colour</h2>
      <button type="button" className="hair-row" disabled={disabled} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="hair-swatch" style={{ background: colour }} aria-hidden="true" />
        <span className="hair-row-label">{index >= 0 ? `Colour ${index + 1}` : colour}</span>
        <Icon name="chevronDown" size={20} className="hair-row-chevron" />
      </button>
      {open ? (
        <Sheet title="Hair colour" onClose={close}>
          {unitId && classId !== null ? (
            <div className="hair-preview"><ClassSprite unitId={unitId} classId={classId} name="Corrin" size={64} hair={colour} run={run} /></div>
          ) : null}
          <div className="hair-grid" role="radiogroup" aria-label="Hair colours">
            {CORRIN_HAIR_COLOURS.map((swatch, swatchIndex) => (
              <button key={swatch} type="button" role="radio" aria-checked={colour === swatch} className="hair-option" style={{ background: swatch }} aria-label={`Colour ${swatchIndex + 1}`} onClick={() => pick(swatch)} />
            ))}
          </div>
          <button type="button" className="btn primary sort-done" onClick={close}>Done</button>
        </Sheet>
      ) : null}
    </section>
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
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            data-blocked={key === blocked ? '' : undefined}
            disabled={disabled}
            onClick={() => onPick(key)}
          >
            <span>{labels(key)}</span>
            <span>({STAT_LABELS[key]})</span>
          </button>
        ))}
      </div>
    </section>
  )
}
