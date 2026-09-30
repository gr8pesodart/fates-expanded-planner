import { usePlanner } from '../app/plannerContext'
import { swapPair } from '../logic/relationships'
import { Icon } from './icons'

export function SwapButton({ unitId, frontName, backName }: { unitId: string; frontName: string; backName: string }) {
  const { readOnly, mutate } = usePlanner()
  return (
    <button
      type="button"
      className="swap-btn"
      aria-label={`Swap ${frontName} and ${backName}`}
      disabled={readOnly}
      onClick={() => mutate((next) => swapPair(next, unitId))}
    >
      <Icon name="swap" size={20} />
    </button>
  )
}
