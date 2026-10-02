import type { AutoResult, OffspringMode } from '../logic/autoProgression'
import type { AutoRequest } from '../logic/autoProgression.worker'
import type { RunPlan } from '../state/model'

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, (result: AutoResult | null) => void>()

/**
 * Automate progression in a Web Worker so the page keeps responding while it searches (hard plans
 * take a second or more on a phone). Falls back to the main thread where workers aren't available.
 */
export async function planProgression(run: RunPlan, unitId: string, bookSkills: number[], offspring: OffspringMode = 'allow'): Promise<AutoResult | null> {
  if (typeof Worker === 'undefined') {
    const [{ loadDataset }, { unitContext }, { autoProgression }] = await Promise.all([import('../data/loader'), import('../logic/army'), import('../logic/autoProgression')])
    const dataset = await loadDataset(run.modpackId)
    const ctx = unitContext(dataset, run, unitId)
    return ctx ? autoProgression(dataset, run, ctx, bookSkills, offspring) : null
  }
  if (!worker) {
    worker = new Worker(new URL('../logic/autoProgression.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<{ id: number; result: AutoResult | null }>) => {
      pending.get(event.data.id)?.(event.data.result)
      pending.delete(event.data.id)
    }
  }
  const id = (nextId += 1)
  const request: AutoRequest = { id, packId: run.modpackId, run, unitId, bookSkills, offspring }
  return new Promise((resolve) => {
    pending.set(id, resolve)
    worker!.postMessage(request)
  })
}
