import { useState } from 'react'

export type SpriteSize = 'sm' | 'md' | 'lg'
export type SpriteKind = 'unit' | 'class' | 'skill'

export interface SpriteProps {
  /** Monogram + alt text source (unit/class/skill name). */
  label: string
  /** Resolved asset URL; when absent the monogram placeholder renders. */
  src?: string
  size?: SpriteSize
  /** Hoshido/Nohr tint on the placeholder. */
  tone?: 'hoshido' | 'nohr'
  /**
   * Future-proof hook for the generated asset manifest: the prototype passes
   * kind/id, M0b resolves `src` from src/data/assets.json.
   */
  kind?: SpriteKind
  id?: string | number
  className?: string
}

const ASSETS_ENABLED = import.meta.env.VITE_ASSETS !== 'off'

function monogram(label: string): string {
  const words = label.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return label.slice(0, 2)
}

export function Sprite({ label, src, size = 'md', tone, className }: SpriteProps) {
  const [failed, setFailed] = useState(false)
  const showImage = ASSETS_ENABLED && Boolean(src) && !failed
  const classes = ['sprite', size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      className={classes}
      data-h={tone === 'hoshido' ? '' : undefined}
      data-n={tone === 'nohr' ? '' : undefined}
      role="img"
      aria-label={label}
    >
      {showImage ? <img src={src} alt="" onError={() => setFailed(true)} draggable={false} /> : monogram(label)}
    </span>
  )
}

/** Generic alias used where the asset is not a game sprite (portraits, icons). */
export const AssetImage = Sprite
