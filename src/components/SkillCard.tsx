import type { ReactNode } from 'react'
import { SkillIcon } from './art'
import { Icon } from './icons'

export interface SkillView {
  id: number
  name: string
  description: string | null
}

/**
 * Icon over name on the left, in-game description on the right (Profile skills, pickers). Around the
 * description: `label` above it (e.g. "Equipped"), the accent `tag` under it (where the skill is
 * learned), then a muted `caution` (e.g. the Taker rule).
 */
export function SkillCard({ skill, locked = false, onClick, label, tag, caution, emptyText = 'Tap to choose a skill.', selected = false, muted = false, faded = false, highlight = false, disabled, notice, aside }: {
  skill: SkillView | null
  locked?: boolean
  onClick?: () => void
  label?: ReactNode
  tag?: ReactNode
  caution?: ReactNode
  /** Description shown while the slot is empty. */
  emptyText?: ReactNode
  selected?: boolean
  /** Still tappable, but dimmed (e.g. equipped in another slot: picking it swaps the slots). */
  muted?: boolean
  /** Not accessible in this run: a grey card with a faint icon. */
  faded?: boolean
  /** A light green card (the inherit picker: skills the child already has equipped). */
  highlight?: boolean
  disabled?: boolean
  /** Full-width inset(s) under the card (SkillNotice). */
  notice?: ReactNode
  /** Beside the description, centred on it (the picker's star). The card stays tappable around it. */
  aside?: ReactNode
}) {
  const main = (
    <>
      <span className="skill-card-id">
        {skill
          ? <SkillIcon skillId={skill.id} name={skill.name} size={24} />
          : <span className="skill-icon" style={{ width: 24, height: 24 }} aria-hidden="true"><Icon name="plus" size={16} /></span>}
        <span className="skill-card-name">{locked && skill ? <LockedName name={skill.name} /> : skill?.name ?? 'Empty slot'}</span>
      </span>
      <span className="skill-card-desc">
        {label ? <span className="skill-card-label">{label}</span> : null}
        {skill ? wrappable(skill.description ?? 'No description.') : <span>{emptyText}</span>}
        {tag ? <span className="skill-card-tag">{tag}</span> : null}
        {caution ? <span className="skill-card-caution">{caution}</span> : null}
      </span>
    </>
  )
  const className = ['skill-card', locked ? 'locked' : '', skill ? '' : 'empty', selected ? 'selected' : '', muted ? 'muted' : '', faded ? 'faded' : '', highlight ? 'highlight' : '', aside ? 'has-aside' : ''].filter(Boolean).join(' ')
  if (aside) {
    // A button can't hold the aside's own button, so the card is a div and its main button stretches
    // over the whole card (::after) beneath the aside.
    return (
      <div className={className}>
        <button type="button" className="skill-card-main" onClick={onClick} disabled={disabled} aria-pressed={selected || undefined}>{main}</button>
        <span className="skill-card-aside">{aside}</span>
        {notice}
      </div>
    )
  }
  const body = <>{main}{notice}</>
  if (!onClick || locked) return <div className={className}>{body}</div>
  return <button type="button" className={className} onClick={onClick} disabled={disabled} aria-pressed={selected || undefined}>{body}</button>
}

/** Lets "Bow/Yumi/Tome/Scroll" (Aegis, Pavise) break after each slash instead of overflowing. */
function wrappable(text: string): string {
  return text.replace(/\//g, '/\u200B')
}

/** The lock reads as the name's first character: it wraps with the first word, never alone. */
function LockedName({ name }: { name: string }) {
  const [first, ...rest] = name.split(' ')
  return (
    <>
      <span className="skill-card-first"><Icon name="lock" size={12} className="skill-card-lock" />{first}</span>
      {rest.length ? ` ${rest.join(' ')}` : null}
    </>
  )
}
