import type { ReactNode } from 'react'

export interface ChipProps {
  children: ReactNode
  variant?: 'plain' | 'accent' | 'warn'
  className?: string
}

export function Chip({ children, variant = 'plain', className }: ChipProps) {
  return <span className={['chip', variant === 'plain' ? '' : variant, className].filter(Boolean).join(' ')}>{children}</span>
}

export interface ChipButtonProps {
  children: ReactNode
  active?: boolean
  variant?: 'plain' | 'accent' | 'warn'
  onClick: () => void
  ariaLabel?: string
  className?: string
}

export function ChipButton({ children, active, variant = 'plain', onClick, ariaLabel, className }: ChipButtonProps) {
  return (
    <button
      type="button"
      className={['chipbtn', className].filter(Boolean).join(' ')}
      aria-pressed={active ?? undefined}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <span className={['chip', variant === 'plain' ? '' : variant, active ? 'accent' : ''].filter(Boolean).join(' ')}>
        {children}
      </span>
    </button>
  )
}
