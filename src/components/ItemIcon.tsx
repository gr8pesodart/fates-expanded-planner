import { useState } from 'react'
import { itemIconUrl, itemName } from '../data/itemIcons'

/** A 16px item icon (seals, class items, skill books); a monogram when assets are off or missing. */
export function ItemIcon({ itemKey, size = 16 }: { itemKey: string; size?: number }) {
  const src = itemIconUrl(itemKey)
  const [failed, setFailed] = useState(false)
  const name = itemName(itemKey)
  return (
    <span className="item-icon" style={{ width: size, height: size }} role="img" aria-label={name} title={name}>
      {src && !failed ? <img src={src} alt="" width={size} height={size} draggable={false} onError={() => setFailed(true)} /> : <span>{name.slice(0, 1)}</span>}
    </span>
  )
}
