import { CONTENT_DLCS } from '../data/dlcs'
import type { DlcGroup } from '../data/dlcs'
import { Switch } from './controls'

const GROUPS: { id: DlcGroup; title: string }[] = [
  { id: 'pack1', title: 'Map Pack 1' },
  { id: 'pack2', title: 'Map Pack 2' },
  { id: 'japan', title: 'Japan-only' },
]

/** The run's DLC category: one toggle per content-providing DLC map (data/dlcs.ts). */
export function DlcChecklist({ value, onChange }: { value: string[]; onChange(dlcIds: string[]): void }) {
  const selected = new Set(value)
  return (
    <fieldset className="mod-checklist">
      <legend className="sub-title">DLC</legend>
      <p className="muted mod-note">Choose the DLC maps this run can use; each one adds its own units, classes or skill books.</p>
      {GROUPS.map(({ id, title }) => (
        <div key={id} className="mod-group">
          <h3 className="mod-group-title">{title}</h3>
          {CONTENT_DLCS.filter((dlc) => dlc.group === id).map((dlc) => (
            <label key={dlc.id} className="mod-option">
              <span className="mod-option-copy">
                <span className="mod-option-name">{dlc.name}</span>
                <span className="muted mod-option-effect">{dlc.effect}</span>
              </span>
              <Switch
                checked={selected.has(dlc.id)}
                onChange={(checked) => {
                  const next = new Set(selected)
                  if (checked) next.add(dlc.id)
                  else next.delete(dlc.id)
                  onChange(CONTENT_DLCS.filter((item) => next.has(item.id)).map((item) => item.id))
                }}
              />
            </label>
          ))}
        </div>
      ))}
    </fieldset>
  )
}
