export interface CapPipsProps {
  mods: number[]
}

export function CapPips({ mods }: CapPipsProps) {
  return (
    <div className="pips" role="img" aria-label={`cap modifiers ${mods.map((m) => (m > 0 ? `+${m}` : m)).join(', ')}`}>
      {mods.map((mod, index) => (
        <i key={index} className={mod > 0 ? 'p' : mod < 0 ? 'm' : undefined} />
      ))}
    </div>
  )
}
