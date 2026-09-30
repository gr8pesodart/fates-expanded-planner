import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ASSETS_ENABLED, portraitArt, spriteLayers } from '../data/art'
import type { SpriteAnimationFrame, SpriteImage } from '../data/art'
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

/** One band of a layered sprite strip, picked with background-position. */
function SpriteCell({ image, x, y, scale, cell }: { image: SpriteImage; x: number; y: number; scale: number; cell: number }) {
  const stripCells = (image.layers ?? 1) * (image.frameCount ?? 1)
  const style: CSSProperties = {
    position: 'absolute',
    left: x * scale,
    top: y * scale,
    width: image.w * scale,
    height: image.h * scale,
    backgroundImage: `url("${image.file}")`,
    backgroundSize: `${stripCells * image.w * scale}px ${image.h * scale}px`,
    backgroundPosition: `${-cell * image.w * scale}px 0`,
  }
  return <span className="sprite-cell" style={style} />
}

/**
 * Map sprite: class body with the unit's head stitched on (offsets from unit/Body/<class>/anime.bin).
 * Heads are [back layer | front layer] strips; the body sits between them, so long hair falls behind
 * it while faces stay in front (tools/assets/extract_sprites.py › HEAD_BANDS).
 */
const STACK: readonly (readonly ['head' | 'body', number])[] = [['head', 0], ['body', 0], ['head', 1]]

function useInViewport(ref: { current: HTMLSpanElement | null }): boolean {
  const [visible, setVisible] = useState(() => !('IntersectionObserver' in window))
  useEffect(() => {
    const node = ref.current
    if (!node || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '64px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])
  return visible
}

function useAnimationIndex(sequence: SpriteAnimationFrame[] | undefined, enabled: boolean): number {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!enabled || !sequence || sequence.length < 2) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return
    let frame = 0
    let timer = 0
    const schedule = () => {
      timer = window.setTimeout(() => {
        frame = (frame + 1) % sequence.length
        setIndex(frame)
        schedule()
      }, Math.max(1, Math.round(sequence[frame][1] * 1000 / 60)))
    }
    const visibility = () => {
      window.clearTimeout(timer)
      if (!document.hidden) schedule()
    }
    const motion = (event: MediaQueryListEvent) => {
      window.clearTimeout(timer)
      if (event.matches) setIndex(0)
      else if (!document.hidden) schedule()
    }
    schedule()
    document.addEventListener('visibilitychange', visibility)
    reducedMotion.addEventListener('change', motion)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', visibility)
      reducedMotion.removeEventListener('change', motion)
    }
  }, [enabled, sequence])
  return sequence?.length ? index % sequence.length : 0
}

const decodedImages = new Set<string>()
const decoding = new Map<string, Promise<void>>()

function decodeImage(src: string): Promise<void> {
  const existing = decoding.get(src)
  if (existing) return existing
  const image = new Image()
  image.decoding = 'async'
  image.src = src
  // A failed load still settles, so a missing file can't hold the sprite back forever.
  const done = image.decode().catch(() => {}).then(() => { decodedImages.add(src) })
  decoding.set(src, done)
  return done
}

/**
 * True once every image has decoded. Heads and bodies are separate files; revealing the sprite
 * only when both are ready stops a headless body (or a floating head) flashing in first.
 */
function useImagesReady(urls: readonly string[]): boolean {
  const key = urls.join('|')
  const ready = urls.every((url) => decodedImages.has(url))
  const [, rerender] = useState(0)
  useEffect(() => {
    if (ready || !key) return
    let cancelled = false
    void Promise.all(key.split('|').map(decodeImage)).then(() => {
      if (!cancelled) rerender((count) => count + 1)
    })
    return () => { cancelled = true }
  }, [key, ready])
  return ready
}

export function ClassSprite({ unitId, classId, name, size = 32, tile = false }: { unitId: string | null; classId: number; name: string; size?: number; tile?: boolean }) {
  const layers = spriteLayers(unitId, classId)
  const spriteRef = useRef<HTMLSpanElement | null>(null)
  const visible = useInViewport(spriteRef)
  const animation = layers?.kind === 'stitched' ? layers.body.animation : layers?.kind === 'single' ? layers.image.animation : undefined
  const animationIndex = useAnimationIndex(animation, visible)
  const frame = animation?.[animationIndex]
  const head = layers?.kind === 'stitched'
    ? layers.offset?.variant === 'small' ? layers.smallHead ?? layers.head : layers.head
    : null
  const ready = useImagesReady(!layers ? [] : layers.kind === 'single' ? [layers.image.file] : [layers.body.file, ...(head ? [head.file] : [])])
  const wrap = (content: ReactNode) => (
    <span ref={spriteRef} className={tile ? 'sprite tile' : 'sprite'} style={{ width: size, height: size }} role="img" aria-label={name}>{content}</span>
  )
  if (!layers) return wrap(<span className="sprite-mono">{monogram(name)}</span>)
  if (!ready) return wrap(null)
  if (layers.kind === 'single' && !layers.image.layers && !layers.image.frameCount) return wrap(<img className="sprite-single" src={layers.image.file} alt="" draggable={false} />)
  const body = layers.kind === 'single' ? layers.image : layers.body
  const offset = layers.kind !== 'stitched' ? null
    : frame?.[2] !== undefined && frame[3] !== undefined ? { x: frame[2], y: frame[3] } : layers.offset
  const bodyCell = frame?.[0] ?? 0
  const scale = size / Math.max(body.w, body.h)
  if (!head || !offset) {
    const bands = Array.from({ length: body.layers ?? 1 }, (_, cell) => cell)
    return wrap(
      <span className="sprite-stage" style={{ width: body.w * scale, height: body.h * scale }}>
        {bands.map((cell) => <SpriteCell key={cell} image={body} x={0} y={0} scale={scale} cell={bodyCell * (body.layers ?? 1) + cell} />)}
      </span>,
    )
  }
  return wrap(
    <span className="sprite-stage" style={{ width: body.w * scale, height: body.h * scale }}>
      {STACK.map(([part, cell]) => {
        const image = part === 'head' ? head : body
        const at = part === 'head' ? offset : { x: 0, y: 0 }
        return cell < (image.layers ?? 1) ? <SpriteCell key={`${part}${cell}`} image={image} x={at.x} y={at.y} scale={scale} cell={bodyCell * (image.layers ?? 1) + cell} /> : null
      })}
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
