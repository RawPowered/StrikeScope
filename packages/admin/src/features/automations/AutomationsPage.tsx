import { useState } from 'react'
import { PageHeader } from '../../layout/PageHeader'
import { Button } from '../../components/ui/button'
import { useAuth } from '../../auth'
import { useAutomationsStatus } from './useAutomations'
import { useActivepiecesEmbed } from './useActivepiecesEmbed'
import AutomationSetupPanel from './AutomationSetupPanel'
import AutomationTemplatesPanel from './AutomationTemplatesPanel'

type Tab = 'builder' | 'setup' | 'templates'

export default function AutomationsPage() {
  const { user } = useAuth()
  const { data: status } = useAutomationsStatus()
  const [tab, setTab] = useState<Tab>('builder')
  const [platformMode, setPlatformMode] = useState(false)
  const isServerAdmin = user?.role === 'server_admin'
  const embedEnabled = tab === 'builder' && Boolean(status?.embedConfigured)
  const { ready, error, containerId, loading } = useActivepiecesEmbed(embedEnabled, platformMode)

  const apUrl = import.meta.env.VITE_ACTIVEPIECES_URL || status?.activepiecesUrl || 'http://localhost:8080'

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[480px]">
      <PageHeader
        title="Automations"
        description="Zapier-style workflows powered by Activepieces"
        actions={(
          <div className="flex gap-2 flex-wrap">
            {isServerAdmin && (
              <Button
                variant={platformMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPlatformMode((v) => !v)}
              >
                {platformMode ? 'Platform templates' : 'Company flows'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.open(apUrl, '_blank')}>
              Open Automations
            </Button>
          </div>
        )}
      />

      <div className="flex gap-2 mb-4">
        {(['builder', 'setup', 'templates'] as Tab[]).map((t) => {
          if (t === 'templates' && !isServerAdmin) return null
          return (
            <Button
              key={t}
              variant={tab === t ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(t)}
            >
              {t === 'builder' ? 'Builder' : t === 'setup' ? 'Setup' : 'Templates'}
            </Button>
          )
        })}
      </div>

      {tab === 'setup' && <AutomationSetupPanel />}
      {tab === 'templates' && <AutomationTemplatesPanel />}

      {tab === 'builder' && (
        <div className="flex-1 min-h-0 border rounded-lg overflow-hidden bg-background">
          {!status?.embedConfigured && (
            <div className="p-6 space-y-3">
              <p className="text-sm">
                Embed SSO is not configured. Use <strong>Open Automations</strong> to build flows in Activepieces,
                then connect StrikeScope via the Setup tab (service key + webhooks).
              </p>
              <p className="text-sm text-muted-foreground">
                To enable in-app builder: set <code>ACTIVEPIECES_SIGNING_KEY</code> and{' '}
                <code>ACTIVEPIECES_SIGNING_KEY_ID</code> on the server (Activepieces Platform → Embedding).
              </p>
              <Button onClick={() => window.open(apUrl, '_blank')}>Open Activepieces</Button>
            </div>
          )}

          {status?.embedConfigured && loading && (
            <div className="p-6 text-sm text-muted-foreground">Loading automation builder…</div>
          )}

          {status?.embedConfigured && error && (
            <div className="p-6 text-sm text-red-400">{error}</div>
          )}

          {status?.embedConfigured && (
            <div
              id={containerId}
              className="w-full h-full min-h-[420px]"
              style={{ display: ready ? 'block' : 'none' }}
            />
          )}
        </div>
      )}
    </div>
  )
}
