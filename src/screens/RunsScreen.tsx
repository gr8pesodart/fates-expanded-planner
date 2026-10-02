import { useRef, useState } from 'react'
import { Icon } from '../components/icons'
import { Switch } from '../components/controls'
import { useToast } from '../components/toast'
import { selectedModIds } from '../data/modProfiles'
import { ModChecklist } from '../components/ModChecklist'
import { ROUTES } from '../data/types'
import { navigate } from '../lib/router'
import type { RunPlan } from '../state/model'
import { shareUrlForRun } from '../state/serialization'
import { usePlansStore } from '../state/store'

function download(name: string, text: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  link.download = name
  link.click()
  URL.revokeObjectURL(link.href)
}

export function RunsScreen() {
  const { runs, activeRunId, selectRun, exportJson, importJson } = usePlansStore()
  const showToast = useToast((state) => state.show)
  const fileInput = useRef<HTMLInputElement>(null)

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      importJson(await file.text())
      showToast('Runs imported.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'That file could not be imported.')
    }
  }

  return (
    <section className="screen runs" aria-labelledby="runs-title">
      <h1 id="runs-title" className="screen-title">Runs</h1>
      <ul className="run-list">
        {runs.map((run) => (
          <RunCard key={run.id} run={run} active={run.id === activeRunId} onSelect={() => selectRun(run.id)} deletable={runs.length > 1} />
        ))}
      </ul>
      <div className="runs-actions">
        <button type="button" className="btn primary" onClick={() => navigate({ name: 'new-run' })}><Icon name="plus" size={20} />New run</button>
        <button type="button" className="btn outline" onClick={() => fileInput.current?.click()}><Icon name="upload" size={20} />Import</button>
        <button type="button" className="btn outline" onClick={() => download('fates-planner-runs.json', exportJson())}><Icon name="download" size={20} />Export all</button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => void onImport(event.target.files?.[0])} />
      </div>
    </section>
  )
}

function RunCard({ run, active, onSelect, deletable }: { run: RunPlan; active: boolean; onSelect(): void; deletable: boolean }) {
  const { updateRun, duplicateRun, deleteRun } = usePlansStore()
  const showToast = useToast((state) => state.show)
  const [menu, setMenu] = useState(false)
  const route = ROUTES.find((item) => item.id === run.route)
  const paired = Object.values(run.units).filter((unit) => unit.sPartner).length / 2
  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrlForRun(run))
      showToast('Share link copied — it opens the chart read-only.')
    } catch {
      showToast('Copying failed; your browser blocked clipboard access.')
    }
  }
  return (
    <li className="run-card" data-route={run.route} aria-current={active || undefined}>
      <button type="button" className="run-main" onClick={onSelect} aria-label={`${active ? 'Active run' : 'Switch to'} ${run.name}`}>
        <span className="run-name">{run.name}</span>
        <span className="run-meta muted">{route?.label} · {selectedModIds(run.modpackId, run.mods).length} mods · DLC {run.dlc ? 'on' : 'off'} · {paired} couple{paired === 1 ? '' : 's'}</span>
        {active ? <span className="run-tag">Active</span> : null}
      </button>
      <button type="button" className="icon-btn run-toggle" aria-label={`Settings for ${run.name}`} aria-expanded={menu} onClick={() => setMenu((open) => !open)}>
        <Icon name="chevronDown" size={24} />
      </button>
      <div className="run-menu-wrap" data-open={menu || undefined}>
        <div className="run-menu-inner" inert={!menu}>
          <div className="run-menu">
            <label className="field">
              <span className="sub-title">Name</span>
              <input value={run.name} onChange={(event) => updateRun(run.id, { name: event.target.value })} />
            </label>
            <ModChecklist profileId={run.modpackId} value={run.mods} onChange={(mods) => updateRun(run.id, { mods })} />
            {/* Same rows as the mod list above, so the run's switches read as one list. */}
            <label className="mod-option">
              <span className="mod-option-copy">
                <span className="mod-option-name">DLC</span>
                <span className="muted mod-option-effect">DLC classes, skills and Anna</span>
              </span>
              <Switch checked={run.dlc} onChange={(dlc) => updateRun(run.id, { dlc })} />
            </label>
            <label className="mod-option">
              <span className="mod-option-copy">
                <span className="mod-option-name">Festival of Bonds DLC</span>
                <span className="muted mod-option-effect">Japan's festival maps: unlimited Hero's and Exalt's Brands</span>
              </span>
              <Switch checked={Boolean(run.dlc && run.festivalDlc)} disabled={!run.dlc} onChange={(festivalDlc) => updateRun(run.id, { festivalDlc })} />
            </label>
            <div className="run-menu-actions">
              <button type="button" className="text-btn" onClick={() => void share()}><Icon name="share" size={18} />Share link</button>
              <button type="button" className="text-btn" onClick={() => duplicateRun(run.id)}>Duplicate</button>
              <button type="button" className="text-btn" onClick={() => download(`${run.name}.json`, JSON.stringify(run, null, 2))}>Export</button>
              {deletable ? (
                <button type="button" className="text-btn danger" onClick={() => {
                  if (window.confirm(`Delete “${run.name}”? This can't be undone.`)) deleteRun(run.id)
                }}>Delete</button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}
