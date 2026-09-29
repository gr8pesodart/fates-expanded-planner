import type { FilterChipVM, UnitSummaryVM } from '../viewmodels/types'
import { ChipButton } from './Chip'
import { UnitRow } from './UnitRow'

export interface UnitListPaneProps {
  query: string
  onSearch: (query: string) => void
  filters: FilterChipVM[]
  units: UnitSummaryVM[]
  activeId?: string
}

export function UnitListPane({ query, onSearch, filters, units, activeId }: UnitListPaneProps) {
  return (
    <div className="listpane">
      <div className="searchbar">
        <input
          type="search"
          value={query}
          placeholder="Search units, classes, skills"
          aria-label="Search units"
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
      <div className="scroller">
        {filters.map((filter) => (
          <ChipButton key={filter.id} active={filter.active} variant={filter.warn ? 'warn' : filter.active ? 'accent' : 'plain'} onClick={filter.onSelect}>
            {filter.label}
            {filter.id === 'all' ? ` ${filter.count}` : filter.count > 0 ? ` ${filter.count}` : ''}
          </ChipButton>
        ))}
      </div>
      <div className="listrows">
        {units.map((unit) => (
          <UnitRow key={unit.id} vm={unit} compact active={unit.id === activeId} />
        ))}
      </div>
    </div>
  )
}
