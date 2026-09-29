import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './icons'
import { useToast } from './toast'

/** Bottom sheet on phones, centred dialog on desktop. Escape and the scrim close it. */
export function Sheet({ title, onClose, children, actions, wide = false }: {
  title: string
  onClose(): void
  children: ReactNode
  actions?: ReactNode
  wide?: boolean
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
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div
        ref={panel}
        className={wide ? 'sheet wide' : 'sheet'}
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
        <div className="sheet-body">{children}</div>
      </div>
    </div>
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
