import { useState } from 'react'
import { assetUrl } from '../data/assets'
import type { AssetKind } from '../data/assets'

export type SpriteSize = 'sm' | 'md' | 'lg'
export type SpriteKind = AssetKind

export interface SpriteProps {
  /** Monogram + alt text source (unit/class/skill name). */
  label: string
  /** Resolved asset URL; when absent the monogram placeholder renders. */
  src?: string
  size?: SpriteSize
  /** Hoshido/Nohr tint on the placeholder. */
  tone?: 'hoshido' | 'nohr'
  /** Look the asset up in the generated manifest by kind + game id. */
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

export function Sprite({ label, src, size = 'md', tone, kind, id, className }: SpriteProps) {
  const [failed, setFailed] = useState(false)
  const resolved = src ?? (kind !== undefined && id !== undefined ? assetUrl(kind, id) : undefined)
  const showImage = ASSETS_ENABLED && Boolean(resolved) && !failed
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
      {showImage ? <img src={resolved} alt="" onError={() => setFailed(true)} draggable={false} /> : monogram(label)}
    </span>
  )
}

/** Generic alias used where the asset is not a game sprite (portraits, icons). */
export const AssetImage = Sprite

