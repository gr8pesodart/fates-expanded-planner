import type { RouteStopVM } from '../viewmodels/types'
import { Chip } from './Chip'
import { SkillGem } from './SkillGem'
import { Sprite } from './Sprite'

export interface RouteTimelineProps {
  stops: RouteStopVM[]
  onAddStop: () => void
}

export function RouteTimeline({ stops, onAddStop }: RouteTimelineProps) {
  return (
    <div className="route card" data-testid="route-timeline">
      {stops.map((stop) => (
        <div className={['stop', stop.done ? 'done' : ''].filter(Boolean).join(' ')} key={stop.id}>
          <div className="rail">
            <span className="dot" />
          </div>
          <div className="box">
            <div className="top">
              <span className="stopclass">
                <Sprite label={stop.name} src={stop.sprite.src} size="sm" />
                <b>{stop.name}</b>
                {stop.dlc ? <Chip variant="accent">DLC</Chip> : null}
              </span>
              <span className="num muted">
                Lv {stop.fromLevel} →
              </span>
              <label className="route-level">
                <span>to</span>
                <input
                  type="number"
                  min={stop.fromLevel}
                  max={stop.maxLevel}
                  step={1}
                  value={stop.toLevel}
                  aria-label={`${stop.name} ending level`}
                  onChange={(event) => {
                    const level = event.currentTarget.valueAsNumber
                    if (Number.isInteger(level)) stop.onSetToLevel(level)
                  }}
                />
                <span className="muted">/ {stop.maxLevel}</span>
              </label>
            </div>
            <div className="stopmeta">
              <span className="seal">{stop.seal}</span>
              <button type="button" className="linkish" onClick={stop.onRemove} aria-label={`Remove ${stop.name} stop`}>
                Remove
              </button>
            </div>
            <div className="learn">
              {stop.skills.map((skill) => (
                <span className="learnitem" key={`${skill.id}-${skill.learnLabel}`}>
                  <SkillGem short={skill.short} name={skill.name} state="on" size="sm" />
                  {skill.name} <span className="num muted">{skill.learnLabel}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
      <div className="stop">
        <div className="rail">
          <span className="dot hollow" />
        </div>
        <div className="box">
          <button type="button" className="btn ghost addstop" onClick={onAddStop}>
            + Add class stop
          </button>
        </div>
      </div>
    </div>
  )
}
