import { useEffect, useState } from 'react'
import { loadDataset } from './loader'
import type { Dataset } from './types'

export type DatasetState =
  | { status: 'loading' }
  | { status: 'ready'; dataset: Dataset }
  | { status: 'error'; message: string }

/** React hook: load a dataset pack by id, cached across components. */
export function useDataset(packId: string): DatasetState {
  const [state, setState] = useState<DatasetState>({ status: 'loading' })

  useEffect(() => {
    let mounted = true
    loadDataset(packId)
      .then((dataset) => {
        if (mounted) setState({ status: 'ready', dataset })
      })
      .catch((error: unknown) => {
        if (mounted) setState({ status: 'error', message: String(error) })
      })
    return () => {
      mounted = false
    }
  }, [packId])

  // A ready dataset from a previous pack id is stale — report loading until
  // the new pack arrives. Keeps the effect free of synchronous setState.
  if (state.status === 'ready' && state.dataset.meta.id !== packId) {
    return { status: 'loading' }
  }
  return state
}
