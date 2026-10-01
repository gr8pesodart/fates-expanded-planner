import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
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
import { AvatarTab } from './character/AvatarTab'
import { ProfileTab } from './character/ProfileTab'
import { ProgressionTab } from './character/ProgressionTab'
import { StatsTab } from './character/StatsTab'
import { ParentsTab } from './character/ParentsTab'

const TAB_LABEL: Record<CharacterTab, string> = { avatar: 'Avatar', profile: 'Profile', stats: 'Stats', progression: 'Progression', parents: 'Parents' }

/**
 * One page per character, except that both Corrins share one: switching gender on the Avatar tab
 * moves the route to the other Corrin without remounting, so the splash cross-fades in place.
 */
export function CharacterPage(props: { unitId: string; tab: CharacterTab; embedded?: boolean }) {
  const { dataset } = usePlanner()
  const key = dataset.unitsById.get(props.unitId)?.isCorrin ? 'corrin' : props.unitId
  return <CharacterScreen key={key} {...props} />
}

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
  }, [])
  const heroTabsRef = useRef<HTMLDivElement | null>(null)
  const pinned = useScrolledPast(heroTabsRef)
  const headRef = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    // Sticky rails inside the tabs (Profile › Classes) sit just under the sticky head.
    const head = headRef.current
    const article = articleRef.current
    if (!head || !article) return
    const measure = () => article.style.setProperty('--char-head-h', `${head.offsetHeight}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(head)
    return () => observer.disconnect()
  }, [])
  const tabs: CharacterTab[] = ctx ? [
    ...(ctx.unit.isCorrin ? ['avatar' as const] : []),
    'profile', 'stats', 'progression',
    ...(ctx.isChild ? ['parents' as const] : []),
  ] : []
  const active = tabs.includes(tab) ? tab : 'profile'
  const activeIndex = tabs.indexOf(active)
  useSwipePager(panelRef, activeIndex, tabs.length, (next) => navigate({ name: 'unit', unitId, tab: tabs[next] }, { replace: true }), tabs.length > 1)
  const mounted = useMountedTabs(active, tabs)
  if (!ctx) {
    return (
      <section className="screen character missing">
        <p className="empty-note">That character isn't in this data pack.</p>
      </section>
    )
  }
  const name = displayName(ctx.unit, run)
  const favourite = run.favourites.includes(unitId)

  return (
    <article ref={articleRef} className="screen character" aria-label={name}>
      {/* Zero-height rail at the top of the page: pinned from the start, so the head slides in and out in place once the hero tabs scroll away. */}
      <div className="char-sticky">
        <div ref={headRef} className="char-sticky-head" data-shown={pinned} inert={!pinned}>
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
        <SplashSwap unitId={unitId} name={name} />
        {embedded ? null : (
          <button type="button" className="back-btn" aria-label="Back" onClick={() => goBack()}>
            <Icon name="arrowLeft" size={24} />
          </button>
        )}
        <div className="char-hero-foot">
          <div className="char-name-row">
            <h1 className="char-name">{name}</h1>
            <StarButton heart on={favourite} name={name} size={22} light disabled={readOnly} onToggle={() => mutate((next) => toggleFavourite(next, unitId))} />
          </div>
          <div ref={heroTabsRef}>
            <CharacterTabs unitId={unitId} name={name} tabs={tabs} active={active} />
          </div>
        </div>
      </header>
      <div ref={panelRef} className="char-panel" data-swipe>
        <TabPager index={activeIndex}>
          {tabs.map((item) => (
            <section key={item} className="pager-page" role="tabpanel" aria-label={TAB_LABEL[item]} data-active={item === active} aria-hidden={item !== active || undefined} inert={item !== active}>
              {mounted.has(item) ? tabContent(item, ctx) : null}
            </section>
          ))}
        </TabPager>
      </div>
    </article>
  )
}

function tabContent(tab: CharacterTab, ctx: NonNullable<ReturnType<typeof unitContext>>): ReactNode {
  switch (tab) {
    case 'avatar': return <AvatarTab />
    case 'profile': return <ProfileTab ctx={ctx} />
    case 'stats': return <StatsTab ctx={ctx} />
    case 'progression': return <ProgressionTab ctx={ctx} />
    case 'parents': return ctx.isChild ? <ParentsTab ctx={ctx} /> : null
  }
}

/**
 * Tabs stay mounted once shown, so a swipe reveals the neighbour's real content instead of it
 * popping in. The opening tab renders first; the rest mount once the page has slid in.
 */
function useMountedTabs(active: CharacterTab, tabs: CharacterTab[]): Set<CharacterTab> {
  const [mounted, setMounted] = useState<Set<CharacterTab>>(() => new Set([active]))
  if (!mounted.has(active)) setMounted(new Set([...mounted, active]))
  const all = tabs.join(' ')
  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(new Set(all.split(' ') as CharacterTab[])), 480)
    return () => window.clearTimeout(timer)
  }, [all])
  return mounted
}

/**
 * Horizontal strip of every tab. The strip follows the drag (`--swipe-dx`, set by useSwipePager on
 * the swipe surface) and eases to the active page; the viewport takes the active page's height so
 * shorter tabs don't inherit a longer one's scroll length.
 */
function TabPager({ index, children }: { index: number; children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const page = viewport?.querySelectorAll<HTMLElement>('.pager-page')[index]
    if (!viewport || !page) return
    const measure = () => viewport.style.setProperty('--pager-h', `${page.offsetHeight}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(page)
    return () => observer.disconnect()
  }, [index])
  return (
    <div ref={viewportRef} className="pager" style={{ '--page': index } as CSSProperties}>
      <div className="pager-track">{children}</div>
    </div>
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

/** Cross-fades to a new splash when the page's unit changes in place (Corrin's gender switch). */
function SplashSwap({ unitId, name }: { unitId: string; name: string }) {
  const [shown, setShown] = useState<{ current: string; previous: string | null }>({ current: unitId, previous: null })
  if (shown.current !== unitId) setShown({ current: unitId, previous: shown.current })
  return (
    <>
      {shown.previous ? <Splash key={shown.previous} unitId={shown.previous} name={name} /> : null}
      <Splash
        key={shown.current}
        unitId={shown.current}
        name={name}
        fading={shown.previous !== null}
        onFaded={() => setShown({ current: shown.current, previous: null })}
      />
    </>
  )
}

/** Official promo art cropped on the face; falls back to the talk portrait over a route-hue wash. */
export function Splash({ unitId, name, fading = false, onFaded }: { unitId: string; name: string; fading?: boolean; onFaded?: () => void }) {
  const art = splashArt(unitId)
  const fade = fading ? { 'data-fading': '', onAnimationEnd: onFaded } : {}
  if (art) {
    return (
      <div className="splash" {...fade}>
        <img src={art.src} alt="" width={art.w} height={art.h} loading="eager" decoding="async" fetchPriority="high" style={{ objectPosition: `${art.focal.x * 100}% ${art.focal.y * 100}%` }} />
      </div>
    )
  }
  return (
    <div className="splash fallback" {...fade}>
      {portraitArt(unitId, 'bust') ? <Portrait unitId={unitId} name={name} crop="bust" className="splash-portrait" /> : null}
    </div>
  )
}
