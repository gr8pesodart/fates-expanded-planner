import { Chip } from '../components/Chip'
import { useRunsVM } from '../viewmodels/useRunsVM'
import { useSetupVM } from '../viewmodels/useSetupVM'

export function SetupScreen() {
  const vm = useSetupVM()
  const runs = useRunsVM()

  return (
    <div className="setup" data-testid="setup">
      <header className="setuphead">
        <a className="btn ghost backbtn" href="#/pairings">
          ← Back to roster
        </a>
        <div>
          <span className="kicker">Setup</span>
          <h1>Plan your run</h1>
          <p className="muted">
            Four quick choices decide who can support whom, which classes exist and what colours the app wears.
          </p>
        </div>
      </header>

      <ol className="steps" aria-label="Setup steps">
        {vm.steps.map((step) => (
          <li className={step.done ? 'done' : ''} key={step.id}>
            <span className="stepnum num">{step.index}</span>
            <b>{step.label}</b>
            <span className="muted">{step.hint}</span>
          </li>
        ))}
      </ol>

      <section className="card setupcard">
        <header className="cardhead">
          <h3>1 · Modpack</h3>
          <Chip>decides the support graph</Chip>
        </header>
        <div className="mods">
          {vm.modpacks.map((modpack) => (
            <button
              type="button"
              key={modpack.id}
              className={['mod', modpack.selected ? 'sel' : ''].filter(Boolean).join(' ')}
              aria-pressed={modpack.selected}
              onClick={modpack.onSelect}
            >
              <span className="modtop">
                <b>{modpack.label}</b>
                {modpack.installed ? <Chip variant="accent">installed</Chip> : <Chip>not installed</Chip>}
              </span>
              <span className="muted">{modpack.blurb}</span>
              <span className="num muted">{modpack.supportNote}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card setupcard">
        <header className="cardhead">
          <h3>2 · Downloadable content</h3>
        </header>
        <label className="toggle">
          <input type="checkbox" checked={vm.dlc} onChange={vm.onToggleDlc} />
          <i aria-hidden="true" />
          <span>
            <b>DLC classes, seals and units are {vm.dlc ? 'on' : 'off'}</b>
            <span className="muted block">
              Off hides Dread Fighter, Dark Falcon, Ballistician, Witch, Lodestar, Vanguard, Great Lord and
              Grandmaster from every pool; plans that use them show a warning chip.
            </span>
          </span>
        </label>
        {vm.dlcWarning ? (
          <div className="warncard">
            <span className="chip warn">!</span>
            <span className="warntext">{vm.dlcWarning}</span>
          </div>
        ) : null}
      </section>

      <section className="card setupcard">
        <header className="cardhead">
          <h3>3 · Route</h3>
          <Chip>accent colour follows the route</Chip>
        </header>
        <div className="routes">
          {vm.routes.map((route) => (
            <button
              type="button"
              key={route.id}
              className={['routeopt', route.selected ? 'sel' : ''].filter(Boolean).join(' ')}
              data-route={route.id}
              aria-pressed={route.selected}
              onClick={route.onSelect}
            >
              <span className="routedot" aria-hidden="true" />
              <b>{route.label}</b>
              <span className="muted">{route.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card setupcard">
        <header className="cardhead">
          <h3>4 · Name the run</h3>
        </header>
        <div className="runname">
          <input
            type="text"
            value={vm.runName}
            aria-label="Run name"
            placeholder="Run name"
            onChange={(event) => vm.onSetRunName(event.target.value)}
          />
          <button type="button" className="btn accent" onClick={vm.onFinish}>
            Start planning
          </button>
          <button type="button" className="btn ghost" onClick={vm.onSkip}>
            Skip
          </button>
        </div>
      </section>

      <section className="card setupcard runs" data-testid="runs-manager">
        <header className="cardhead">
          <h3>Runs</h3>
          <Chip>{runs.runs.length}</Chip>
        </header>
        <div className="runlist">
          {runs.runs.map((run) => (
            <div className={['runitem', run.active ? 'active' : ''].filter(Boolean).join(' ')} key={run.id}>
              <button type="button" className="runmain" onClick={run.onSelect} aria-pressed={run.active}>
                <span className="runrow">
                  <b>{run.name}</b>
                  {run.active ? <Chip variant="accent">active</Chip> : null}
                </span>
                <span className="muted">
                  {run.modpackLabel} · {run.routeLabel}
                  {run.dlc ? ' · DLC on' : ' · no DLC'}
                </span>
                <span className="num muted">
                  {run.unitCount} units · {run.pairCount} pairs · updated {run.updatedAt}
                </span>
              </button>
              <div className="runactions">
                <button type="button" className="linkish" onClick={run.onDuplicate}>
                  Duplicate
                </button>
                <button type="button" className="linkish" onClick={run.onExport}>
                  Export
                </button>
                <button type="button" className="linkish danger" onClick={run.onDelete}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="runsfoot">
          <button type="button" className="btn" onClick={runs.onCreateRun}>
            New run
          </button>
          <button type="button" className="btn ghost" onClick={runs.onImport}>
            Import JSON
          </button>
          <button type="button" className="btn ghost" onClick={runs.onShareLink}>
            {runs.copied ? 'Copied ✓' : 'Copy share link'}
          </button>
        </div>
        <p className="muted smallnum">{runs.shareHint}</p>
      </section>
    </div>
  )
}
