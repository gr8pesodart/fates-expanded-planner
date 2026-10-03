import { Fragment, useContext, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { PlannerContext } from '../app/plannerContext'
import { ASSETS_ENABLED, cutinArt, defaultHairColour, portraitArt, spriteLayers } from '../data/art'
import type { SpriteAnimationFrame, SpriteImage } from '../data/art'
import { assetUrl } from '../data/assets'
import { hairColourOf } from '../logic/hair'
import { motionPaused, onMotionChange } from '../lib/motion'

function monogram(label: string): string {
  const words = label.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return (words[0] ?? '?').slice(0, 2)
}

/**
 * Talk-portrait crop. The crop box is square, so percentage background sizing frames it in any
 * square container without knowing its pixel size. Units with a recolourable hair layer get the
 * layer tinted to their run colour drawn on top of the same crop.
 */
export function Portrait({ unitId, name, crop = 'face', className = '' }: { unitId: string; name: string; crop?: 'face' | 'bust'; className?: string }) {
  const art = portraitArt(unitId, crop)
  const [failed, setFailed] = useState(false)
  const hairColour = useHairColour(unitId)
  const tintedHairUrl = useTintedImage(art?.hair?.file ?? null, hairColour)
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
  const frame: CSSProperties = {
    backgroundImage: `url("${art.src}")`,
    backgroundSize: `${(art.w / w) * 100}% ${(art.h / w) * 100}%`,
    backgroundPosition: `${art.w === w ? 0 : (x / (art.w - w)) * 100}% ${art.h === w ? 0 : (y / (art.h - w)) * 100}%`,
  }
  const hairFrame: CSSProperties = {
    ...frame,
    backgroundImage: tintedHairUrl ? `url("${tintedHairUrl}")` : 'none',
  }
  return (
    <span className={`portrait cropped ${className}`} role="img" aria-label={name} style={frame}>
      {tintedHairUrl ? <span className="portrait-hair" style={hairFrame} /> : null}
    </span>
  )
}

/** Character page hero: the unit's critical / skill cut-in (phase 2), hair tinted per run. */
export function CutinArt({ unitId }: { unitId: string }) {
  const art = cutinArt(unitId)
  const hairColour = useHairColour(unitId)
  const tintedHairUrl = useTintedImage(art?.hair?.file ?? null, hairColour)
  if (!art) return null
  return (
    <>
      <img className="cutin-base" src={art.src} width={art.w} height={art.h} alt="" loading="eager" decoding="async" fetchPriority="high" />
      {tintedHairUrl ? <img className="cutin-hair" src={tintedHairUrl} width={art.w} height={art.h} alt="" /> : null}
    </>
  )
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

// One observer for every sprite: hundreds of per-sprite observers each cost a pass on every frame
// that moves anything (swipes showed it in traces).
const viewportListeners = new Map<Element, (visible: boolean) => void>()
let viewportObserver: IntersectionObserver | null = null

function observeViewport(node: Element, listener: (visible: boolean) => void): () => void {
  viewportObserver ??= new IntersectionObserver((entries) => {
    for (const entry of entries) viewportListeners.get(entry.target)?.(entry.isIntersecting)
  }, { rootMargin: '64px' })
  viewportListeners.set(node, listener)
  viewportObserver.observe(node)
  return () => {
    viewportListeners.delete(node)
    viewportObserver?.unobserve(node)
  }
}

function useInViewport(ref: { current: HTMLSpanElement | null }): boolean {
  const [visible, setVisible] = useState(() => !('IntersectionObserver' in window))
  useEffect(() => {
    const node = ref.current
    if (!node || !('IntersectionObserver' in window)) return
    return observeViewport(node, setVisible)
  }, [ref])
  return visible
}

// One clock for every sprite, at each class's own loop length (40–134 game frames): sprites whose
// loops share a length restart together, and every copy of a class stays in step. Different
// lengths drift relative to each other, as in the game (owner preferred this to stretching every
// loop to one cycle). A sprite that scrolls into view joins mid-cycle instead of restarting.
const CLOCK_EPOCH = performance.now()
const TICK_MS = 1000 / 60

/**
 * The frame showing at `now` on the shared clock, and the ms until it changes. Frames with a 0 delay
 * are skipped, as the game does: Kitsune, Nine-Tails (F) and Blacksmith (F) end their scripts with
 * 0-delay poses, and showing them for a tick flicked back through poses 2 and 1 before each restart.
 */
function frameAt(sequence: SpriteAnimationFrame[], now: number): { index: number; wait: number } {
  const total = sequence.reduce((sum, frame) => sum + Math.max(0, frame[1]), 0)
  if (total <= 0) return { index: 0, wait: TICK_MS }
  const elapsed = now - CLOCK_EPOCH
  let tick = Math.floor(elapsed / TICK_MS) % total
  for (let index = 0; index < sequence.length; index += 1) {
    const delay = Math.max(0, sequence[index][1])
    if (tick < delay) return { index, wait: (delay - tick) * TICK_MS - (elapsed % TICK_MS) }
    tick -= delay
  }
  return { index: 0, wait: TICK_MS }
}

function useAnimationIndex(sequence: SpriteAnimationFrame[] | undefined, enabled: boolean): number {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!enabled || !sequence || sequence.length < 2) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return
    let timer = 0
    const tick = () => {
      // Frozen while something slides; onMotionChange restarts the clock (it rejoins mid-cycle).
      if (motionPaused()) return
      const { index: current, wait } = frameAt(sequence, performance.now())
      setIndex(current)
      timer = window.setTimeout(tick, Math.max(1, wait))
    }
    const visibility = () => {
      window.clearTimeout(timer)
      if (!document.hidden) tick()
    }
    const motion = (event: MediaQueryListEvent) => {
      window.clearTimeout(timer)
      if (event.matches) setIndex(0)
      else if (!document.hidden) tick()
    }
    tick()
    document.addEventListener('visibilitychange', visibility)
    reducedMotion.addEventListener('change', motion)
    const stopListening = onMotionChange(visibility)
    return () => {
      stopListening()
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

// The hair mask's main lit grey shows exactly the colour; darker greys shade it (as
// tools/assets/extract_sprites.py › tint_ramp, so runtime tints match the extracted defaults).
// Overlay washed hair out and a ×2 modulate clipped light colours to pure white.
const HAIR_REFERENCE_GREY = 0xbb

function tintTables(hex: string): Uint8Array[] {
  return [1, 3, 5].map((offset) => {
    const colour = parseInt(hex.slice(offset, offset + 2), 16)
    const table = new Uint8Array(256)
    for (let value = 0; value < 256; value += 1) table[value] = Math.min(255, Math.floor((value * colour) / HAIR_REFERENCE_GREY))
    return table
  })
}

/** `${hair strip}|${colour}` → tinted hair-only strip URL, or null when tinting failed (default shows). */
const tintedHair = new Map<string, string | null>()
const tinting = new Map<string, Promise<void>>()

/**
 * Loaded *and decoded*: WebKit can fire `load` before decoding, and while the page is loading many
 * images at once `drawImage` then paints nothing — the tint came out blank for the colour in use at
 * startup (owner report, iPhone, v3.3).
 */
async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = src
  await image.decode()
  return image
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/**
 * The grey hair mask tinted `colour`, hair pixels only, as an object URL (cached). It is drawn over
 * the extracted head, so a failed or blank tint can only leave the default hair colour showing —
 * never remove the head.
 */
function tintHair(hair: string, colour: string): Promise<void> {
  const key = `${hair}|${colour}`
  const existing = tinting.get(key)
  if (existing) return existing
  const draw = async (attempt: number): Promise<{ canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; pixels: ImageData }> => {
    const mask = await loadImage(hair)
    const canvas = document.createElement('canvas')
    canvas.width = mask.naturalWidth
    canvas.height = mask.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('no canvas')
    context.drawImage(mask, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    // Every hair strip has opaque pixels; a blank read means the browser wasn't ready yet.
    if (!pixels.data.some((value, index) => index % 4 === 3 && value > 0)) {
      if (attempt >= 3) throw new Error('blank hair strip')
      for (let frame = 0; frame < 10 * (attempt + 1); frame += 1) await nextFrame()
      return draw(attempt + 1)
    }
    return { canvas, context, pixels }
  }
  const job = draw(0).then(({ canvas, context, pixels }) => {
    const tables = tintTables(colour)
    const data = pixels.data
    for (let i = 0; i < data.length; i += 4) {
      if (!data[i + 3]) continue
      data[i] = tables[0][data[i]]
      data[i + 1] = tables[1][data[i + 1]]
      data[i + 2] = tables[2][data[i + 2]]
      data[i + 3] = 255
    }
    context.putImageData(pixels, 0, 0)
    return new Promise<void>((resolve) => canvas.toBlob((blob) => {
      tintedHair.set(key, blob ? URL.createObjectURL(blob) : null)
      resolve()
    }))
  }).catch(() => { tintedHair.set(key, null) })
  tinting.set(key, job)
  return job
}

/** A same-layout overlay of `image`'s hair tinted `colour`; `pending` until it exists. */
function useTintedHair(image: SpriteImage | null, colour: string | null): { overlay: SpriteImage | null; pending: boolean } {
  const hair = image?.hair
  const key = hair && colour ? `${hair}|${colour}` : null
  const done = key !== null && tintedHair.has(key)
  const [, rerender] = useState(0)
  useEffect(() => {
    if (!key || done || !hair || !colour) return
    let cancelled = false
    void tintHair(hair, colour).then(() => {
      if (!cancelled) rerender((count) => count + 1)
    })
    return () => { cancelled = true }
  }, [key, done, hair, colour])
  const file = key ? tintedHair.get(key) : null
  return { overlay: image && file ? { ...image, file } : null, pending: key !== null && !done }
}

/** A whole-image version of the hair tint (talk portraits, cut-ins): the tinted URL, or null. */
function useTintedImage(src: string | null, colour: string | null): string | null {
  const key = src && colour ? `${src}|${colour}` : null
  const done = key !== null && tintedHair.has(key)
  const [, rerender] = useState(0)
  useEffect(() => {
    if (!key || done || !src || !colour) return
    let cancelled = false
    void tintHair(src, colour).then(() => {
      if (!cancelled) rerender((count) => count + 1)
    })
    return () => { cancelled = true }
  }, [key, done, src, colour])
  return key ? tintedHair.get(key) ?? null : null
}

/**
 * The colour to tint a unit's recolourable hair in this run (logic/hair.ts), or null when the
 * extracted default already shows it. `override` serves draft runs (the new-run flow).
 */
function useHairColour(unitId: string | null, override?: string | null): string | null {
  const planner = useContext(PlannerContext)
  if (!unitId) return null
  const colour = override !== undefined ? override : planner ? hairColourOf(planner.dataset, planner.run, unitId, defaultHairColour) : null
  return colour && colour.toLowerCase() !== defaultHairColour(unitId)?.toLowerCase() ? colour : null
}

export function ClassSprite({ unitId, classId, name, size = 32, hair }: {
  unitId: string | null
  classId: number
  name: string
  size?: number
  /** Hair colour to show instead of the run's (draft runs); null = extracted default. */
  hair?: string | null
}) {
  const resolved = spriteLayers(unitId, classId)
  const spriteRef = useRef<HTMLSpanElement | null>(null)
  const visible = useInViewport(spriteRef)
  const hairColour = useHairColour(unitId, hair)
  const rawHead = resolved?.kind === 'stitched'
    ? resolved.offset?.variant === 'small' ? resolved.smallHead ?? resolved.head : resolved.head
    : null
  const headHair = useTintedHair(rawHead, hairColour)
  const singleHair = useTintedHair(resolved?.kind === 'single' ? resolved.image : null, hairColour)
  const layers = resolved
  const head = rawHead
  const overlays = [headHair.overlay, singleHair.overlay].flatMap((overlay) => (overlay ? [overlay.file] : []))
  const animation = layers?.kind === 'stitched' ? layers.body.animation : layers?.kind === 'single' ? layers.image.animation : undefined
  const animationIndex = useAnimationIndex(animation, visible)
  const frame = animation?.[animationIndex]
  const decoded = useImagesReady(!layers ? [] : [...(layers.kind === 'single' ? [layers.image.file] : [layers.body.file, ...(head ? [head.file] : [])]), ...overlays])
  // Wait for the tint too, so the default colour never flashes before the chosen one.
  const ready = decoded && !headHair.pending && !singleHair.pending
  const wrap = (content: ReactNode) => (
    <span ref={spriteRef} className="sprite" style={{ width: size, height: size }} role="img" aria-label={name}>{content}</span>
  )
  if (!layers) return wrap(<span className="sprite-mono">{monogram(name)}</span>)
  if (!ready) return wrap(null)
  if (layers.kind === 'single' && !layers.image.layers && !layers.image.frameCount) return wrap(<img className="sprite-single" src={layers.image.file} alt="" draggable={false} />)
  const body = layers.kind === 'single' ? layers.image : layers.body
  const offset = layers.kind !== 'stitched' ? null
    : frame?.[2] !== undefined && frame[3] !== undefined ? { x: frame[2], y: frame[3] } : layers.offset
  const bodyCell = frame?.[0] ?? 0
  // Pixel art: only integer scales stay crisp, so round down (never below 1x) instead of fitting.
  const scale = Math.max(1, Math.floor(size / Math.max(body.w, body.h)))
  if (!head || !offset) {
    const bands = Array.from({ length: body.layers ?? 1 }, (_, cell) => cell)
    return wrap(
      <span className="sprite-stage" style={{ width: body.w * scale, height: body.h * scale }}>
        {bands.map((cell) => <SpriteCell key={cell} image={body} x={0} y={0} scale={scale} cell={bodyCell * (body.layers ?? 1) + cell} />)}
        {singleHair.overlay ? bands.map((cell) => <SpriteCell key={`hair${cell}`} image={singleHair.overlay!} x={0} y={0} scale={scale} cell={bodyCell * (body.layers ?? 1) + cell} />) : null}
      </span>,
    )
  }
  return wrap(
    <span className="sprite-stage" style={{ width: body.w * scale, height: body.h * scale }}>
      {STACK.map(([part, cell]) => {
        const image = part === 'head' ? head : body
        const at = part === 'head' ? offset : { x: 0, y: 0 }
        if (cell >= (image.layers ?? 1)) return null
        const index = bodyCell * (image.layers ?? 1) + cell
        // The tinted hair covers the extracted hair in the same band (back hair behind the body).
        return (
          <Fragment key={`${part}${cell}`}>
            <SpriteCell image={image} x={at.x} y={at.y} scale={scale} cell={index} />
            {part === 'head' && headHair.overlay ? <SpriteCell image={headHair.overlay} x={at.x} y={at.y} scale={scale} cell={index} /> : null}
          </Fragment>
        )
      })}
    </span>,
  )
}

/** Skill icons are 24×24 in the game; like map sprites they only draw at whole multiples (24, 48…). */
export const SKILL_ICON_PX = 24

export function SkillIcon({ skillId, name, size = SKILL_ICON_PX }: { skillId: number | null; name: string; size?: number }) {
  const src = ASSETS_ENABLED && skillId !== null ? assetUrl('skill', skillId) : undefined
  const [failed, setFailed] = useState(false)
  const box = SKILL_ICON_PX * Math.max(1, Math.round(size / SKILL_ICON_PX))
  return (
    <span className="skill-icon" style={{ width: box, height: box }} role="img" aria-label={name}>
      {src && !failed ? <img src={src} alt="" draggable={false} onError={() => setFailed(true)} /> : <span>{monogram(name).slice(0, 1)}</span>}
    </span>
  )
}
