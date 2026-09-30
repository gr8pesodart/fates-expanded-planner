import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ASSETS_ENABLED, portraitArt, spriteLayers } from '../data/art'
import type { SpriteImage } from '../data/art'
import { assetUrl } from '../data/assets'

function monogram(label: string): string {
  const words = label.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return (words[0] ?? '?').slice(0, 2)
}

/**
 * Talk-portrait crop. The crop box is square, so percentage background sizing frames it in any
 * square container without knowing its pixel size.
 */
export function Portrait({ unitId, name, crop = 'face', className = '' }: { unitId: string; name: string; crop?: 'face' | 'bust'; className?: string }) {
  const art = portraitArt(unitId, crop)
  const [failed, setFailed] = useState(false)
  if (!art || failed) {
    return <span className={`portrait mono ${className}`} role="img" aria-label={name}>{monogram(name)}</span>
  }
  if (!art.box) {
    return (
      <span className={`portrait ${className}`} role="img" aria-label={name}>
        <img src={art.src} alt="" draggable={false} onError={() => setFailed(true)} />
      </span>
    )
  }
  const [x, y, w] = art.box
  const style: CSSProperties = {
    backgroundImage: `url("${art.src}")`,
    backgroundSize: `${(art.w / w) * 100}% ${(art.h / w) * 100}%`,
    backgroundPosition: `${art.w === w ? 0 : (x / (art.w - w)) * 100}% ${art.h === w ? 0 : (y / (art.h - w)) * 100}%`,
  }
  return <span className={`portrait cropped ${className}`} role="img" aria-label={name} style={style} />
}

/**
 * One cell of a sprite image. Layered images are [low | high] strips of the game's per-pixel
 * draw-priority mask, so a cell is picked with background-position.
 */
function SpriteCell({ image, x, y, scale, cell }: { image: SpriteImage; x: number; y: number; scale: number; cell: 0 | 1 }) {
  const style: CSSProperties = {
    position: 'absolute',
    left: x * scale,
    top: y * scale,
    width: image.w * scale,
    height: image.h * scale,
    backgroundImage: `url("${image.file}")`,
    backgroundSize: `${(image.layers ?? 1) * image.w * scale}px ${image.h * scale}px`,
    backgroundPosition: `${-cell * image.w * scale}px 0`,
  }
  return <span className="sprite-cell" style={style} />
}

/**
 * Map sprite: class body with the unit's head stitched on (offsets from unit/Body/<class>/anime.bin).
 * Higher draw priority wins and the head wins ties, which with the game's two body and two head
 * levels is the stack body-low, head-low (back hair), body-high, head-high.
 */
export function ClassSprite({ unitId, classId, name, size = 32, tile = false }: { unitId: string | null; classId: number; name: string; size?: number; tile?: boolean }) {
  const layers = spriteLayers(unitId, classId)
  const wrap = (content: ReactNode) => (
    <span className={tile ? 'sprite tile' : 'sprite'} style={{ width: size, height: size }} role="img" aria-label={name}>{content}</span>
  )
  if (!layers) return wrap(<span className="sprite-mono">{monogram(name)}</span>)
  if (layers.kind === 'single' && !layers.image.layers) return wrap(<img className="sprite-single" src={layers.image.file} alt="" draggable={false} />)
  const body = layers.kind === 'single' ? layers.image : layers.body
  const head = layers.kind === 'stitched' ? layers.head : null
  const offset = layers.kind === 'stitched' ? layers.offset : null
  const scale = size / Math.max(body.w, body.h)
  const cell = (image: SpriteImage, x: number, y: number, level: 0 | 1) =>
    level === 1 && !image.layers ? null : <SpriteCell image={image} x={x} y={y} scale={scale} cell={level} />
  return wrap(
    <span className="sprite-stage" style={{ width: body.w * scale, height: body.h * scale }}>
      {cell(body, 0, 0, 0)}
      {head && offset ? cell(head, offset.x, offset.y, 0) : null}
      {cell(body, 0, 0, 1)}
      {head && offset ? cell(head, offset.x, offset.y, 1) : null}
    </span>,
  )
}

export function SkillIcon({ skillId, name, size = 20 }: { skillId: number | null; name: string; size?: number }) {
  const src = ASSETS_ENABLED && skillId !== null ? assetUrl('skill', skillId) : undefined
  const [failed, setFailed] = useState(false)
  return (
    <span className="skill-icon" style={{ width: size, height: size }} role="img" aria-label={name}>
      {src && !failed ? <img src={src} alt="" draggable={false} onError={() => setFailed(true)} /> : <span>{monogram(name).slice(0, 1)}</span>}
    </span>
  )
}
