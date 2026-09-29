import { BottomSheet } from '../components/BottomSheet'
import { Chip } from '../components/Chip'
import { RouteTimeline } from '../components/RouteTimeline'
import { Sprite } from '../components/Sprite'
import { WarningCard } from '../components/WarningCard'
import { useClassRouteVM } from '../viewmodels/useClassRouteVM'

export function UnitRouteScreen({ unitId }: { unitId: string }) {
  const vm = useClassRouteVM(unitId)

  return (
    <section className="routescreen" data-testid={`route-${vm.unit.id}`}>
      <header className="card routehead">
        <button type="button" className="btn ghost backbtn" onClick={vm.onBack} aria-label="Back to unit">
          ←
        </button>
        <Sprite label={vm.unit.name} src={vm.unit.sprite.src} tone={vm.unit.sprite.tone} size="md" />
        <div className="unitheadtext">
          <h2>{vm.unit.name} · Class route</h2>
          <span className="muted">Seal timeline, skills learned and rule checks</span>
        </div>
        <button type="button" className="btn ghost" onClick={vm.onOpenUnit}>
          Open unit
        </button>
      </header>

      <RouteTimeline stops={vm.stops} onAddStop={vm.onOpenAddStop} />

      {vm.warnings.map((warning) => (
        <WarningCard key={warning.id} warning={warning} />
      ))}

      <BottomSheet
        open={vm.addStopOpen}
        title="Add class stop"
        subtitle="Candidates from every branch this unit can reach"
        onClose={vm.onCloseAddStop}
        testId="add-stop-sheet"
      >
        <div className="optionlist">
          {vm.addStopOptions.map((option) => (
            <button type="button" key={option.classId} className="rowitem" onClick={option.onPick}>
              <Sprite label={option.name} src={option.sprite.src} size="sm" />
              <span className="rowbody">
                <span className="rowname">{option.name}</span>
                <span className="rowbadges">
                  <Chip>{option.sourceLabel}</Chip>
                  <Chip variant="accent">{option.seal}</Chip>
                  {option.dlc ? <Chip variant="warn">DLC</Chip> : null}
                </span>
              </span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </section>
  )
}
