import type { ReactNode } from 'react'
import { SkillIcon } from './art'
import { Icon } from './icons'

export interface SkillView {
  id: number
  name: string
  description: string | null
}

/** Icon over name on the left, in-game description on the right (Profile skills, pickers). */
export function SkillCard({ skill, locked = false, onClick, tag, selected = false, disabled }: {
  skill: SkillView | null
  locked?: boolean
  onClick?: () => void
  tag?: ReactNode
  selected?: boolean
  disabled?: boolean
}) {
  const body = (
    <>
      <span className="skill-card-id">
        <SkillIcon skillId={skill?.id ?? null} name={skill?.name ?? 'Empty'} size={32} />
        <span className="skill-card-name">{skill?.name ?? 'Empty slot'}</span>
      </span>
      <span className="skill-card-desc">
        {skill ? skill.description ?? 'No description.' : 'Tap to choose a skill.'}
        {tag ? <span className="skill-card-tag">{tag}</span> : null}
      </span>
      {locked ? <Icon name="lock" size={16} className="skill-card-lock" /> : null}
    </>
  )
  const className = ['skill-card', locked ? 'locked' : '', skill ? '' : 'empty', selected ? 'selected' : ''].filter(Boolean).join(' ')
  if (!onClick || locked) return <div className={className}>{body}</div>
  return <button type="button" className={className} onClick={onClick} disabled={disabled} aria-pressed={selected || undefined}>{body}</button>
}
