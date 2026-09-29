import type { Lens } from '../lib/router'

const LENS_ORDER: Lens[] = ['pairings', 'individual', 'preview']
const LENS_LABELS: Record<Lens, string> = {
  pairings: 'Pairings',
  individual: 'Individual',
  preview: 'Preview',
}

export interface LensSwitcherProps {
  active: Lens
  onSelect: (lens: Lens) => void
}

export function LensSwitcher({ active, onSelect }: LensSwitcherProps) {
  const index = LENS_ORDER.indexOf(active)
  return (
    <nav className="lens" aria-label="Roster lens">
      <span className="thumb" style={{ transform: `translateX(${index * 100}%)` }} aria-hidden="true" />
      {LENS_ORDER.map((lens) => (
        <button key={lens} type="button" aria-pressed={active === lens} onClick={() => onSelect(lens)}>
          {LENS_LABELS[lens]}
        </button>
      ))}
    </nav>
  )
}
