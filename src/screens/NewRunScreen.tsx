import { useState } from 'react'
import { Switch } from '../components/controls'
import { Icon } from '../components/icons'
import { ModChecklist } from '../components/ModChecklist'
import { ROUTES } from '../data/types'
import { goBack, navigate } from '../lib/router'
import { emptyRun } from '../state/model'
import type { RunPlan } from '../state/model'
import { usePlansStore } from '../state/store'
import { AvatarTab } from './character/AvatarTab'

const STEPS = ['Run', 'Route', 'Your Corrin'] as const

export function NewRunScreen({ first = false }: { first?: boolean }) {
  const createRun = usePlansStore((state) => state.createRun)
  const [draft, setDraft] = useState<RunPlan>(() => ({ ...emptyRun('draft'), name: first ? 'My run' : 'New run' }))
  const [step, setStep] = useState(0)
  const update = setDraft
  const finish = () => {
    createRun({ name: draft.name.trim() || 'New run', modpackId: draft.modpackId, mods: draft.mods, dlc: draft.dlc, route: draft.route, corrin: draft.corrin })
    navigate({ name: 'roster' }, { replace: true })
  }
  return (
    <section className="screen new-run" data-route={draft.route} aria-labelledby="new-run-title">
      <div className="screen-head">
        <h1 id="new-run-title" className="screen-title">{first ? 'Welcome' : 'New run'}</h1>
        {first ? null : <button type="button" className="icon-btn" aria-label="Cancel" onClick={() => goBack({ name: 'runs' })}><Icon name="close" size={26} /></button>}
      </div>
      <ol className="steps" aria-label="Setup steps">
        {STEPS.map((label, index) => (
          <li key={label} aria-current={index === step ? 'step' : undefined} data-done={index < step ? '' : undefined}>{label}</li>
        ))}
      </ol>

      <div className="new-run-body">
        {step === 0 ? (
          <>
            <label className="field">
              <span className="sub-title">Run name</span>
              <input value={draft.name} onChange={(event) => update({ ...draft, name: event.target.value })} autoFocus />
            </label>
            <ModChecklist profileId={draft.modpackId} value={draft.mods} onChange={(mods) => update({ ...draft, mods })} />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="route-cards" role="radiogroup" aria-label="Route">
              {ROUTES.map((route) => (
                <button
                  key={route.id}
                  type="button"
                  role="radio"
                  aria-checked={draft.route === route.id}
                  className="route-card"
                  data-route={route.id}
                  onClick={() => update({ ...draft, route: route.id })}
                >
                  <span className="route-name">{route.label}</span>
                  <span className="route-blurb">{route.id === 'birthright' ? 'Hoshido' : route.id === 'conquest' ? 'Nohr' : 'Valla'}</span>
                </button>
              ))}
            </div>
            <label className="switch-row">
              <span>
                <span className="sub-title">DLC</span>
                <span className="muted block">DLC classes, skills and Anna</span>
              </span>
              <Switch checked={draft.dlc} onChange={(dlc) => update({ ...draft, dlc })} />
            </label>
          </>
        ) : null}

        {step === 2 ? <AvatarTab run={draft} onChange={update} /> : null}
      </div>

      <div className="new-run-foot">
        {step > 0 ? <button type="button" className="btn outline" onClick={() => setStep(step - 1)}>Back</button> : <span />}
        {step < STEPS.length - 1
          ? <button type="button" className="btn primary" onClick={() => setStep(step + 1)}>Next</button>
          : <button type="button" className="btn primary" onClick={finish}>Start planning</button>}
      </div>
    </section>
  )
}
