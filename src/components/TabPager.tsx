import { useEffect, useLayoutEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { settleMotion } from '../lib/motion'

/**
 * Horizontal strip of every page. The strip follows the drag (`--swipe-dx`, set by useSwipePager on
 * the swipe surface) and eases to the active page. By default the viewport takes the active page's
 * height so shorter pages don't inherit a longer one's scroll length; `fill` pages instead fill a
 * fixed-height parent and scroll on their own (each keeps its scroll position).
 */
export function TabPager({ index, children, fill = false }: { index: number; children: ReactNode; fill?: boolean }) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    settleMotion()
  }, [index])
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const page = viewport?.querySelectorAll<HTMLElement>(':scope > .pager-track > .pager-page')[index]
    if (fill || !viewport || !page) return
    const measure = () => viewport.style.setProperty('--pager-h', `${page.offsetHeight}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(page)
    return () => observer.disconnect()
  }, [index, fill])
  return (
    <div ref={viewportRef} className={fill ? 'pager fill' : 'pager'} style={{ '--page': index } as CSSProperties}>
      <div className="pager-track">{children}</div>
    </div>
  )
}

/** One page of a TabPager; inactive pages are inert and hidden from assistive tech. */
export function PagerPage({ active, label, children, className = '' }: { active: boolean; label: string; children: ReactNode; className?: string }) {
  return (
    <section className={`pager-page ${className}`} role="tabpanel" aria-label={label} data-active={active} aria-hidden={!active || undefined} inert={!active}>
      {children}
    </section>
  )
}
