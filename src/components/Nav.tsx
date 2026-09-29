import type { AppRoute, NavSection } from '../lib/router'
import { navigate } from '../lib/router'
import type { IconName } from './icons'
import { Icon } from './icons'

const ITEMS: { id: NavSection; label: string; icon: IconName; active: IconName; route: AppRoute }[] = [
  { id: 'roster', label: 'Roster', icon: 'navRoster', active: 'navRosterFilled', route: { name: 'roster' } },
  { id: 'chart', label: 'Chart', icon: 'navChart', active: 'navChartFilled', route: { name: 'chart' } },
  { id: 'runs', label: 'Runs', icon: 'navRuns', active: 'navRuns', route: { name: 'runs' } },
]

export function Nav({ section }: { section: NavSection }) {
  return (
    <nav className="nav" aria-label="Main">
      {ITEMS.map((item) => (
        <a
          key={item.id}
          href={`#/${item.id}`}
          className="nav-item"
          aria-current={section === item.id ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault()
            navigate(item.route)
          }}
        >
          <Icon name={section === item.id ? item.active : item.icon} size={30} />
          {item.label}
        </a>
      ))}
    </nav>
  )
}
