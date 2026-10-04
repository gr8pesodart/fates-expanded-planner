import { BUILD_PROFILES, selectedModIds } from '../data/modProfiles'
import { Switch } from './controls'

const PROFILE = BUILD_PROFILES.find((item) => item.id === 'ugf-2.5.2')!

export function ModChecklist({ profileId, value, onChange }: { profileId: string; value?: string[]; onChange(mods: string[]): void }) {
  const selected = new Set(selectedModIds(profileId, value))
  return (
    <fieldset className="mod-checklist">
      <legend className="sub-title">Mods</legend>
      <p className="muted mod-note">Choose the rules and art for this run. UGF stays on while the vanilla data pack is pending.</p>
      {(['data', 'vanity'] as const).map((category) => (
        <div key={category} className="mod-group">
          <h3 className="mod-group-title">{category === 'data' ? 'Game data' : 'Vanity'}</h3>
          {PROFILE.mods.filter((mod) => mod.category === category).map((mod) => (
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
        </div>
      ))}
    </fieldset>
  )
}
