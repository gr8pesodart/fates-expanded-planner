interface IconProps {
  className?: string
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function IconPlan({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 4 3 6.2v13.6l6-2.2 6 2.2 6-2.2V3.8l-6 2.2-6-2Z" />
      <path d="M9 4v13.6M15 6v13.6" />
    </svg>
  )
}

export function IconSupports({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="12" r="5.2" />
      <circle cx="15" cy="12" r="5.2" />
    </svg>
  )
}

export function IconReference({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 5.2C7 3.9 9.7 3.9 12 5.4c2.3-1.5 5-1.5 8-.2v14.2c-3-1.3-5.7-1.3-8 .2-2.3-1.5-5-1.5-8-.2V5.2Z" />
      <path d="M12 5.4v14.1" />
    </svg>
  )
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8" />
    </svg>
  )
}

export function Sigil({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path
        d="M32 7 54 32 32 57 10 32 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M23 26 41 44 M41 26 23 44"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity=".8"
      />
      <path d="M32 16v32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="32" r="3.6" fill="currentColor" />
    </svg>
  )
}
