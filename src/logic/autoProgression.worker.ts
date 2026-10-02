import { loadDataset } from '../data/loader'
import type { RunPlan } from '../state/model'
import { unitContext } from './army'
import type { AutoOptions } from './autoProgression'
import { autoProgression } from './autoProgression'

/** Runs the automate-progression search off the main thread (a hard plan takes a second or two). */
export interface AutoRequest {
  id: number
  packId: string
  run: RunPlan
  unitId: string
  options: AutoOptions
}

// Typed as a Worker: the app's tsconfig has the DOM lib, not the webworker one.
const scope = self as unknown as Worker

scope.onmessage = async (event: MessageEvent<AutoRequest>) => {
  const { id, packId, run, unitId, options } = event.data
  try {
    const dataset = await loadDataset(packId)
    const ctx = unitContext(dataset, run, unitId)
    const result = ctx ? autoProgression(dataset, run, ctx, options) : null
    scope.postMessage({ id, result })
  } catch (error) {
    scope.postMessage({ id, result: null, error: String(error) })
  }
}
