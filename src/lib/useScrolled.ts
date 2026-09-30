import { useEffect, useRef, useState } from 'react'

/** True once the zero-height sentinel just above a sticky header has scrolled out of the top of its scrollport. */
export function useScrolled() {
  const sentinelRef = useRef<HTMLSpanElement | null>(null)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting && entry.boundingClientRect.top < 0))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return { sentinelRef, scrolled }
}
