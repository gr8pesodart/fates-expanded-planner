export type HankoRank = 'S' | 'A+' | '♥'

export interface HankoProps {
  rank: HankoRank
  size?: 'sm' | 'md'
}

export function Hanko({ rank, size = 'md' }: HankoProps) {
  const classes = ['hanko', rank === 'A+' ? 'aplus' : '', rank === '♥' ? 'gold' : '', size === 'sm' ? 'sm' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <span className={classes} aria-label={rank === '♥' ? 'paired' : `${rank} support`}>
      {rank}
    </span>
  )
}
