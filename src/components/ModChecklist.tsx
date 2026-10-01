import { BUILD_PROFILES, selectedModIds } from '../data/modProfiles'
import { Switch } from './controls'

const PROFILE = BUILD_PROFILES.find((item) => item.id === 'ugf-2.5.2')!

export function ModChecklist({ profileId, value, onChange }: { profileId: string; value?: string[]; onChange(mods: string[]): void }) {
  const selected = new Set(selectedModIds(profileId, value))
  return (
    <fieldset className="mod-checklist">
      <legend className="sub-title">Mods</legend>
      <p className="muted mod-note">Choose the mods in this run. UGF stays on while the vanilla data pack is pending.</p>
      {PROFILE.mods.map((mod) => (
        <label key={mod.id} className="mod-option">
          <span className="mod-option-copy">
            <span className="mod-option-name">{mod.name}{mod.required ? ' · Required' : ''}</span>
            <span className="muted mod-option-effect">{mod.effect}</span>
          </span>
          <Switch
            checked={selected.has(mod.id)}
            disabled={mod.required}
            onChange={(checked) => {
              const next = new Set(selected)
              if (checked) next.add(mod.id)
              else next.delete(mod.id)
              onChange(selectedModIds(profileId, [...next]))
            }}
          />
        </label>
      ))}
    </fieldset>
  )
}
