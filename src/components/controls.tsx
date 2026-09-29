import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './icons'

export interface RailItem<T extends string | number> {
  id: T
  label: string
}

/** Horizontal scroller of lens/class choices; keeps the active item in view. */
export function Rail<T extends string | number>({ items, active, onSelect, variant, label }: {
  items: readonly RailItem<T>[]
  active: T
  onSelect(id: T): void
  variant: 'tabs' | 'pills'
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    node?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [active])
  return (
    <div ref={ref} className={`rail rail-${variant}`} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === active}
          className="rail-item"
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, label, disabled }: {
  options: readonly { id: T; label: string }[]
  value: T
  onChange(value: T): void
  label: string
  disabled?: boolean
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          disabled={disabled}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function StarButton({ on, onToggle, name, size = 16, light = false, disabled }: {
  on: boolean
  onToggle(): void
  name: string
  size?: number
  light?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={light ? 'star light' : 'star'}
      aria-pressed={on}
      aria-label={on ? `Unfavourite ${name}` : `Favourite ${name}`}
      disabled={disabled}
      onClick={onToggle}
    >
      <Icon name={on ? 'star' : 'starOutline'} size={size} />
    </button>
  )
}

export function EditButton({ onClick, label, size = 28 }: { onClick(): void; label: string; size?: number }) {
  return (
    <button type="button" className="edit-btn" style={{ width: size, height: size }} aria-label={label} onClick={onClick}>
      <Icon name="arrowRight" size={Math.round(size * 0.72)} />
    </button>
  )
}

export function SectionHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="section-head">
      <h2 className="section-title">{title}</h2>
      {children}
    </div>
  )
}
