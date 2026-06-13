import { NavLink } from 'react-router-dom'
import { cn } from '../lib/utils'

export interface SectionTab {
  label: string
  path: string
  end?: boolean
  badge?: number
}

export function SectionTabs({ tabs, className }: { tabs: SectionTab[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-0 border-b border-border mb-4', className)}>
      {tabs.map(tab => (
        <NavLink
          key={tab.path}
          to={tab.path}
          end={tab.end}
          className={({ isActive }) => cn(
            'relative px-4 py-2.5 text-sm font-medium transition-colors -mb-px',
            isActive ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
          {tab.badge != null && tab.badge > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700">
              {tab.badge}
            </span>
          )}
        </NavLink>
      ))}
    </div>
  )
}
