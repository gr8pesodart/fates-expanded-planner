export interface SkillGemProps {
  /** Two-character abbreviation shown in the diamond. */
  short?: string
  name?: string
  state?: 'on' | 'off' | 'empty'
  size?: 'sm' | 'md'
  onClick?: () => void
  className?: string
}

export function SkillGem({ short, name, state = 'off', size = 'md', onClick, className }: SkillGemProps) {
  const classes = ['skill', state === 'on' ? 'on' : '', state === 'empty' ? 'empty' : '', size === 'sm' ? 'sm' : '', className]
    .filter(Boolean)
    .join(' ')
  const content = <span>{state === 'empty' ? '+' : (short ?? '??')}</span>
  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-label={name ?? 'skill slot'}>
        {content}
      </button>
    )
  }
  return (
    <span className={classes} role="img" aria-label={name ?? (state === 'empty' ? 'empty skill slot' : 'skill')}>
      {content}
    </span>
  )
}
