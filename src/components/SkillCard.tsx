import type { ReactNode } from 'react'
import { SkillIcon } from './art'
import { Icon } from './icons'

export interface SkillView {
  id: number
  name: string
  description: string | null
}

/** Icon over name on the left, in-game description on the right (Profile skills, pickers). */
export function SkillCard({ skill, locked = false, onClick, tag, emptyText = 'Tap to choose a skill.', selected = false, muted = false, disabled, notice }: {
  skill: SkillView | null
  locked?: boolean
  onClick?: () => void
  tag?: ReactNode
  /** Description shown while the slot is empty. */
  emptyText?: ReactNode
  selected?: boolean
  /** Still tappable, but dimmed (e.g. equipped in another slot: picking it swaps the slots). */
  muted?: boolean
  disabled?: boolean
  /** Full-width inset under the card (SkillNotice). */
  notice?: ReactNode
}) {
  const body = (
    <>
      <span className="skill-card-id">
        {skill
          ? <SkillIcon skillId={skill.id} name={skill.name} size={24} />
          : <span className="skill-icon" style={{ width: 24, height: 24 }} aria-hidden="true"><Icon name="plus" size={16} /></span>}
        <span className="skill-card-name">
          {locked ? <Icon name="lock" size={12} className="skill-card-lock" /> : null}
          {skill?.name ?? 'Empty slot'}
        </span>
      </span>
      <span className="skill-card-desc">
        {skill ? skill.description ?? 'No description.' : <span>{emptyText}</span>}
        {tag ? <span className="skill-card-tag">{tag}</span> : null}
      </span>
      {notice}
    </>
  )
  const className = ['skill-card', locked ? 'locked' : '', skill ? '' : 'empty', selected ? 'selected' : '', muted ? 'muted' : ''].filter(Boolean).join(' ')
  if (!onClick || locked) return <div className={className}>{body}</div>
  return <button type="button" className={className} onClick={onClick} disabled={disabled} aria-pressed={selected || undefined}>{body}</button>
}
