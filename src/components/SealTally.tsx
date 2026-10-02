import { useEffect, useRef, useState } from 'react'
import type { TallyItem } from '../logic/tally'
import { Icon } from './icons'
import { ItemIcon } from './ItemIcon'

/**
 * Every seal, class item and skill book a plan uses, as a pill of "[icon] x2" with no text (owner,
 * v3.4); the info button opens a dark tooltip listing them by name.
 */
export function SealTally({ items }: { items: readonly TallyItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  if (!items.length) return null
  return (
    <div ref={ref} className="seal-pill" aria-label="Seals and items used">
      <ul className="seal-tally">
        {items.map((item) => (
          <li key={item.id} className="seal-tally-item" aria-label={`${item.name} x${item.count}`}>
            {item.key ? <ItemIcon itemKey={item.key} /> : <span className="seal-tally-name">{item.name}</span>}
            <span aria-hidden="true">x{item.count}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="seal-pill-info" aria-label="List seals and items" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="info" size={16} />
      </button>
      {open ? (
        <div className="seal-tooltip" role="tooltip">
          {items.map((item) => (
            <span key={item.id} className="seal-tooltip-item">
              {item.key ? <ItemIcon itemKey={item.key} /> : null}
              {item.name} x{item.count}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
