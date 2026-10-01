import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { Icon } from './icons'
import { useToast } from './toast'

/** Bottom sheet on phones, centred dialog on desktop. Escape and the scrim close it. */
export function Sheet({ title, onClose, children, actions, toolbar, wide = false, closing = false }: {
  title: string
  onClose(): void
  children: ReactNode
  actions?: ReactNode
  /** Fixed under the title (e.g. tabs); the body scrolls beneath it. */
  toolbar?: ReactNode
  wide?: boolean
  closing?: boolean
}) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus()
    }
  }, [onClose])
  // Portalled to the app root: a sheet opened inside the character tab strip would otherwise be
  // positioned against its transformed track instead of the viewport.
  return createPortal(
    <div className="sheet-scrim" data-closing={closing || undefined} onClick={onClose}>
      <div
        ref={panel}
        className={`${wide ? 'sheet wide' : 'sheet'}${closing ? ' closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 id={titleId} className="sheet-title">{title}</h2>
          {actions}
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="close" size={22} /></button>
        </div>
        {toolbar ? <div className="sheet-toolbar">{toolbar}</div> : null}
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.querySelector('.app') ?? document.body,
  )
}

export function Toaster() {
  const { message, clear } = useToast()
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(clear, 3200)
    return () => window.clearTimeout(timer)
  }, [message, clear])
  return <div className="toast" role="status" aria-live="polite" data-open={message ? '' : undefined}>{message}</div>
}
