import type { ReactNode } from 'react'
import { SkillIcon } from './art'
import { Icon } from './icons'

export interface SkillView {
  id: number
  name: string
  description: string | null
}

/** Icon over name on the left, in-game description on the right (Profile skills, pickers). */
export function SkillCard({ skill, locked = false, onClick, tag, emptyText = 'Tap to choose a skill.', selected = false, disabled }: {
  skill: SkillView | null
  locked?: boolean
  onClick?: () => void
  tag?: ReactNode
  /** Description shown while the slot is empty. */
  emptyText?: ReactNode
  selected?: boolean
  disabled?: boolean
}) {
  const body = (
    <>
      <span className="skill-card-id">
        {skill
          ? <SkillIcon skillId={skill.id} name={skill.name} size={32} />
          : <span className="skill-icon" style={{ width: 32, height: 32 }} aria-hidden="true"><Icon name="plus" size={18} /></span>}
        {locked ? <Icon name="lock" size={16} className="skill-card-lock" /> : null}
        <span className="skill-card-name">{skill?.name ?? 'Empty slot'}</span>
      </span>
      <span className="skill-card-desc">
        {skill ? skill.description ?? 'No description.' : <span>{emptyText}</span>}
        {tag ? <span className="skill-card-tag">{tag}</span> : null}
      </span>
    </>
  )
  const className = ['skill-card', locked ? 'locked' : '', skill ? '' : 'empty', selected ? 'selected' : ''].filter(Boolean).join(' ')
  if (!onClick || locked) return <div className={className}>{body}</div>
  return <button type="button" className={className} onClick={onClick} disabled={disabled} aria-pressed={selected || undefined}>{body}</button>
}
