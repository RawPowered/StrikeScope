import { SectionTabs } from '../../layout/SectionTabs'
import { useTerritoryConfig, useTerritoryFilters } from './useTerritoryFilters'
import { US_STATES } from '../../lib/us-states'

export function TerritoryTabs() {
  const { data: config } = useTerritoryConfig()
  const { state, setState } = useTerritoryFilters()

  if (!config?.enabledStates?.length || !config.splitByState) return null

  const enabled = config.enabledStates
  const tabs = [
    { label: 'All', path: '.', end: true },
    ...enabled.map(code => ({
      label: US_STATES.find(s => s.code === code)?.name || code,
      path: `?state=${code}`,
      end: false,
    })),
  ]

  return (
    <SectionTabs
      tabs={tabs.map(t => ({
        label: t.label,
        path: t.path,
        end: t.end,
      }))}
      className="mb-2"
    />
  )
}

export function TerritoryTabsBar({ onStateChange }: { onStateChange?: (state: string) => void }) {
  const { data: config } = useTerritoryConfig()
  const { state, setState } = useTerritoryFilters()

  if (!config?.enabledStates?.length || !config.splitByState) return null

  return (
    <div className="flex flex-wrap gap-1 border-b border-border mb-3">
      <button
        type="button"
        onClick={() => { setState(''); onStateChange?.('') }}
        className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${!state ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
      >
        All
      </button>
      {config.enabledStates.map(code => (
        <button
          key={code}
          type="button"
          onClick={() => { setState(code); onStateChange?.(code) }}
          className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${state === code ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
        >
          {US_STATES.find(s => s.code === code)?.name || code}
        </button>
      ))}
    </div>
  )
}
