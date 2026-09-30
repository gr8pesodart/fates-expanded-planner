import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { usePlanner } from '../app/plannerContext'
import { Portrait } from '../components/art'
import { StarButton } from '../components/controls'
import { Icon } from '../components/icons'
import { portraitArt, splashArt } from '../data/art'
import { displayName, unitContext } from '../logic/army'
import { toggleFavourite } from '../logic/relationships'
import type { CharacterTab } from '../lib/router'
import { goBack, navigate } from '../lib/router'
import { useSwipePager } from '../lib/swipe'
import { SlideSwap } from '../components/SlideSwap'
import { AvatarTab } from './character/AvatarTab'
import { ProfileTab } from './character/ProfileTab'
import { ProgressionTab } from './character/ProgressionTab'
import { StatsTab } from './character/StatsTab'
import { ParentsTab } from './character/ParentsTab'

const TAB_LABEL: Record<CharacterTab, string> = { avatar: 'Avatar', profile: 'Profile', stats: 'Stats', progression: 'Progression', parents: 'Parents' }

export function CharacterScreen({ unitId, tab, embedded = false }: { unitId: string; tab: CharacterTab; embedded?: boolean }) {
  const { dataset, run, readOnly, mutate } = usePlanner()
  const ctx = useMemo(() => unitContext(dataset, run, unitId), [dataset, run, unitId])
  const articleRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    // On mobile the page scrolls inside its own layer; scrolling the window would move the
    // roster underneath it.
    const layer = articleRef.current?.closest('.character-layer')
    if (layer) {
      layer.scrollTo(0, 0)
      return
    }
    document.querySelector('.main')?.scrollTo(0, 0)
    window.scrollTo(0, 0)
  }, [unitId])
  const heroTabsRef = useRef<HTMLDivElement | null>(null)
  const pinned = useScrolledPast(heroTabsRef)
  const tabs: CharacterTab[] = ctx ? [
    ...(ctx.unit.isCorrin ? ['avatar' as const] : []),
    'profile', 'stats', 'progression',
    ...(ctx.isChild ? ['parents' as const] : []),
  ] : []
  const active = tabs.includes(tab) ? tab : 'profile'
  const activeIndex = tabs.indexOf(active)
  useSwipePager(panelRef, activeIndex, tabs.length, (next) => navigate({ name: 'unit', unitId, tab: tabs[next] }, { replace: true }), tabs.length > 1)
  if (!ctx) {
    return (
      <section className="screen character missing">
        <p className="empty-note">That character isn't in this data pack.</p>
      </section>
    )
  }
  const name = displayName(ctx.unit)
  const favourite = run.favourites.includes(unitId)

  return (
    <article ref={articleRef} className="screen character" aria-label={name}>
      {/* Zero-height rail at the top of the page: pinned from the start, so the head slides in and out in place once the hero tabs scroll away. */}
      <div className="char-sticky">
        <div className="char-sticky-head" data-shown={pinned} inert={!pinned}>
          <div className="char-sticky-top">
            {embedded ? null : (
              <button type="button" className="icon-btn char-sticky-back" aria-label="Back" onClick={() => goBack()}>
                <Icon name="arrowLeft" size={24} />
              </button>
            )}
            <h2 className="char-sticky-name">{name}</h2>
          </div>
          <CharacterTabs unitId={unitId} name={name} tabs={tabs} active={active} />
        </div>
      </div>
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
          <div ref={heroTabsRef}>
            <CharacterTabs unitId={unitId} name={name} tabs={tabs} active={active} />
          </div>
        </div>
      </header>
      <div ref={panelRef} className="char-panel" role="tabpanel" aria-label={TAB_LABEL[active]} data-swipe>
        <SlideSwap index={activeIndex}>
          {active === 'avatar' ? <AvatarTab /> : null}
          {active === 'profile' ? <ProfileTab ctx={ctx} /> : null}
          {active === 'stats' ? <StatsTab ctx={ctx} /> : null}
          {active === 'progression' ? <ProgressionTab ctx={ctx} /> : null}
          {active === 'parents' && ctx.isChild ? <ParentsTab ctx={ctx} /> : null}
        </SlideSwap>
      </div>
    </article>
  )
}

function CharacterTabs({ unitId, name, tabs, active }: { unitId: string; name: string; tabs: CharacterTab[]; active: CharacterTab }) {
  return (
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
  )
}

function useScrolledPast(ref: { current: HTMLElement | null }): boolean {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0))
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])
  return past
}

/** Official promo art cropped on the face; falls back to the talk portrait over a route-hue wash. */
export function Splash({ unitId, name }: { unitId: string; name: string }) {
  const art = splashArt(unitId)
  if (art) {
    return (
      <div className="splash">
        <img src={art.src} alt="" width={art.w} height={art.h} loading="eager" decoding="async" fetchPriority="high" style={{ objectPosition: `${art.focal.x * 100}% ${art.focal.y * 100}%` }} />
      </div>
    )
  }
  return (
    <div className="splash fallback">
      {portraitArt(unitId, 'bust') ? <Portrait unitId={unitId} name={name} crop="bust" className="splash-portrait" /> : null}
    </div>
  )
}
