import { useEffect } from 'react'

/**
 * Keeps a scroller's selected item (`[aria-selected="true"]`) centred, scrolling smoothly when the
 * selection changes. Scrolls the rail only: scrollIntoView would also scroll the page to a rail below
 * the fold.
 */
export function useActiveInView(ref: { current: HTMLElement | null }, active: unknown): void {
  useEffect(() => {
    const rail = ref.current
    const node = rail?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!rail || !node) return
    const offset = node.getBoundingClientRect().left - rail.getBoundingClientRect().left
    rail.scrollTo({ left: rail.scrollLeft + offset - (rail.clientWidth - node.offsetWidth) / 2, behavior: 'smooth' })
  }, [ref, active])
}
