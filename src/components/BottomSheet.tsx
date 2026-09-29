import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export interface BottomSheetProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  testId?: string
}

export function BottomSheet({ open, title, subtitle, onClose, children, testId }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="sheetwrap" role="presentation" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        ref={sheetRef}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheethead">
          <span className="grab" aria-hidden="true" />
          <div className="sheettitle">
            <h3>{title}</h3>
            {subtitle ? <span className="muted">{subtitle}</span> : null}
          </div>
          <button type="button" className="btn ghost closebtn" onClick={onClose} ref={closeRef} aria-label="Close">
            ×
          </button>
        </header>
        <div className="sheetbody">{children}</div>
      </div>
    </div>
  )
}
