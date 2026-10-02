import { useLayoutEffect, useRef } from 'react'
import { useActiveInView } from '../lib/useActiveInView'
import type { ReactNode } from 'react'
import { Icon } from './icons'

export interface RailItem<T extends string | number> {
  id: T
  label: string
  /** Drawn before the label (e.g. the favourite star on class pills). */
  icon?: ReactNode
}

/**
 * Horizontal scroller of lens/class choices; keeps the active item in view. Pills tween their colours;
 * tabs share one underline that slides and resizes to the active tab.
 */
export function Rail<T extends string | number>({ items, active, onSelect, variant, label, className = '' }: {
  items: readonly RailItem<T>[]
  active: T
  onSelect(id: T): void
  variant: 'tabs' | 'pills'
  label: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  useActiveInView(ref, active)
  const labels = items.map((item) => item.label).join('|')
  useLayoutEffect(() => {
    const rail = ref.current
    const indicator = indicatorRef.current
    if (!rail || !indicator) return
    const place = () => {
      const node = rail.querySelector<HTMLElement>('[aria-selected="true"]')
      indicator.hidden = !node
      if (!node) return
      // A 1px bar scaled to the tab: transform only, so the slide stays on the compositor.
      indicator.style.transform = `translateX(${node.offsetLeft}px) scaleX(${node.offsetWidth})`
    }
    place()
    // The first placement (and font or size changes) shouldn't animate in from the left edge.
    const frame = requestAnimationFrame(() => { indicator.dataset.ready = '' })
    const observer = new ResizeObserver(place)
    for (const node of rail.children) observer.observe(node)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [active, labels])
  return (
    <div ref={ref} className={`rail rail-${variant} ${className}`} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === active}
          className="rail-item"
          onClick={() => onSelect(item.id)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
      {variant === 'tabs' ? <span ref={indicatorRef} className="rail-indicator" aria-hidden="true" /> : null}
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

/** Favourite toggle. Units on the roster use a heart; class and parent favourites use the star. */
export function StarButton({ on, onToggle, name, size = 16, light = false, disabled, className = '', heart = false }: {
  on: boolean
  onToggle(): void
  name: string
  size?: number
  light?: boolean
  disabled?: boolean
  className?: string
  heart?: boolean
}) {
  return (
    <button
      type="button"
      className={['star', light ? 'light' : '', className].filter(Boolean).join(' ')}
      aria-pressed={on}
      aria-label={on ? `Unfavourite ${name}` : `Favourite ${name}`}
      disabled={disabled}
      onClick={onToggle}
    >
      <Icon name={heart ? (on ? 'heart' : 'heartOutline') : on ? 'star' : 'starOutline'} size={heart ? Math.round(size * 1.15) : size} />
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

/**
 * The app's only toggle (owner, v3.3): a pill with ON / OFF in the space beside the knob, route
 * accent when on, muted grey when off. Inside a <label>, the label text names it and toggles it.
 */
export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange(checked: boolean): void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="switch-text switch-on" aria-hidden="true">ON</span>
      <span className="switch-text switch-off" aria-hidden="true">OFF</span>
      <span className="switch-knob" aria-hidden="true" />
    </button>
  )
}
