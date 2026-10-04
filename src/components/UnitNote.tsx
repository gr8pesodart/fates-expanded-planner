import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePlanner } from '../app/plannerContext'
import { emptyUnitPlan } from '../state/model'

export function UnitNote({ unitId, name, className = '' }: { unitId: string; name: string; className?: string }) {
  const { run, readOnly, mutate } = usePlanner()
  const note = run.units[unitId]?.note ?? ''
  const [draft, setDraft] = useState({ unitId, note, value: note })
  if (draft.unitId !== unitId || draft.note !== note) setDraft({ unitId, note, value: note })
  const input = useRef<HTMLTextAreaElement>(null)
  const pending = useRef<number | undefined>(undefined)

  useLayoutEffect(() => {
    const node = input.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight + node.offsetHeight - node.clientHeight}px`
  }, [draft.value])
  useEffect(() => () => window.clearTimeout(pending.current), [])

  const save = (next: string) => {
    window.clearTimeout(pending.current)
    if (next === note) return
    mutate((runPlan) => ({
      ...runPlan,
      units: { ...runPlan.units, [unitId]: { ...(runPlan.units[unitId] ?? emptyUnitPlan()), note: next } },
    }))
  }

  return <textarea
    ref={input}
    className={`unit-note ${className}`.trim()}
    aria-label={`${name} note`}
    placeholder="Add a note"
    rows={1}
    value={draft.value}
    readOnly={readOnly}
    onChange={(event) => {
      const next = event.target.value
      setDraft({ unitId, note, value: next })
      window.clearTimeout(pending.current)
      pending.current = window.setTimeout(() => save(next), 450)
    }}
    onBlur={() => save(draft.value)}
  />
}
