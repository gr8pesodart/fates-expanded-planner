import { useMemo } from 'react'
import { usePlanner } from '../app/plannerContext'
import { Portrait } from '../components/art'
import { StarButton } from '../components/controls'
import { Icon } from '../components/icons'
import { splashArt } from '../data/art'
import { displayName, unitContext } from '../logic/army'
import { toggleFavourite } from '../logic/relationships'
import type { CharacterTab } from '../lib/router'
import { goBack, navigate } from '../lib/router'
import { AvatarTab } from './character/AvatarTab'
import { ProfileTab } from './character/ProfileTab'
import { ProgressionTab } from './character/ProgressionTab'
import { StatsTab } from './character/StatsTab'

const TAB_LABEL: Record<CharacterTab, string> = { avatar: 'Avatar', profile: 'Profile', stats: 'Stats', progression: 'Progression' }

export function CharacterScreen({ unitId, tab, embedded = false }: { unitId: string; tab: CharacterTab; embedded?: boolean }) {
  const { dataset, run, readOnly, mutate } = usePlanner()
  const ctx = useMemo(() => unitContext(dataset, run, unitId), [dataset, run, unitId])
  if (!ctx) {
    return (
      <section className="screen character missing">
        <p className="empty-note">That character isn't in this data pack.</p>
      </section>
    )
  }
  const name = displayName(ctx.unit)
  const tabs: CharacterTab[] = ctx.unit.isCorrin ? ['avatar', 'profile', 'stats', 'progression'] : ['profile', 'stats', 'progression']
  const active = tabs.includes(tab) ? tab : 'profile'
  const favourite = run.favourites.includes(unitId)

  return (
    <article className="screen character" aria-label={name}>
      <header className="char-hero">
        <Splash unitId={unitId} name={name} />
        {embedded ? null : (
          <button type="button" className="back-btn" aria-label="Back" onClick={() => goBack()}>
            <Icon name="arrowLeft" size={24} />
          </button>
        )}
        <div className="char-hero-foot">
          <div className="char-name-row">
            <h1 className="char-name">{name}</h1>
            <StarButton on={favourite} name={name} size={22} light disabled={readOnly} onToggle={() => mutate((next) => toggleFavourite(next, unitId))} />
          </div>
          <div className="char-tabs" role="tablist" aria-label={`${name} sections`}>
            {tabs.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={item === active}
                onClick={() => navigate({ name: 'unit', unitId, tab: item }, { replace: true })}
              >
                {TAB_LABEL[item]}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="char-panel" role="tabpanel" aria-label={TAB_LABEL[active]}>
        {active === 'avatar' ? <AvatarTab /> : null}
        {active === 'profile' ? <ProfileTab ctx={ctx} /> : null}
        {active === 'stats' ? <StatsTab ctx={ctx} /> : null}
        {active === 'progression' ? <ProgressionTab ctx={ctx} /> : null}
      </div>
    </article>
  )
}

/** Official promo art cropped on the face; falls back to the talk portrait over a route-hue wash. */
export function Splash({ unitId, name }: { unitId: string; name: string }) {
  const art = splashArt(unitId)
  if (art) {
    return (
      <div className="splash">
        <img src={art.src} alt="" style={{ objectPosition: `${art.focal.x * 100}% ${art.focal.y * 100}%` }} />
      </div>
    )
  }
  return (
    <div className="splash fallback">
      <Portrait unitId={unitId} name={name} crop="bust" className="splash-portrait" />
    </div>
  )
}
