import { useEffect, useState } from 'react'
import { loadDataset } from './loader'
import type { Dataset } from './types'

export interface DatasetResource {
  data: Dataset | null
  error: Error | null
  loading: boolean
}

interface DatasetState extends DatasetResource {
  packId: string | null
}

const EMPTY_RESOURCE: DatasetState = { packId: null, data: null, error: null, loading: true }

export function useDataset(packId: string): DatasetResource {
  const [resource, setResource] = useState<DatasetState>(EMPTY_RESOURCE)

  useEffect(() => {
    let current = true
    loadDataset(packId).then(
      (data) => {
        if (current) setResource({ packId, data, error: null, loading: false })
      },
      (cause: unknown) => {
        if (current) {
          const error = cause instanceof Error ? cause : new Error('The selected dataset could not be loaded.')
          setResource({ packId, data: null, error, loading: false })
        }
      },
    )
    return () => {
      current = false
    }
  }, [packId])

  return resource.packId === packId
    ? resource
    : { data: null, error: null, loading: true }
}
