import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api'
import { PageHeader } from '../layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { LoadingState } from '../components/EmptyState'
import type { BrandingConfig } from '@strikescope/shared/src/types'

const DEFAULT_BRANDING: BrandingConfig = {
  primary: '#F57C00',
  secondary: '#4FC3F7',
  accent: '#FFD54F',
  grey: '#9E9E9E',
  gunmetal: '#2C3439',
  white: '#FFFFFF',
  appName: 'StrikeScope',
}

const COLOR_FIELDS: { key: keyof BrandingConfig; label: string }[] = [
  { key: 'primary', label: 'Primary (Orange)' },
  { key: 'secondary', label: 'Secondary (Light Blue)' },
  { key: 'accent', label: 'Accent (Yellow)' },
  { key: 'grey', label: 'Grey' },
  { key: 'gunmetal', label: 'Gunmetal' },
  { key: 'white', label: 'White' },
]

export default function Branding() {
  const [config, setConfig] = useState<BrandingConfig>(DEFAULT_BRANDING)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<BrandingConfig>('/api/branding')
      .then(r => { if (r.ok && r.data) setConfig(r.data) })
      .catch(() => toast.error('Failed to load branding'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    const r = await api.put('/api/branding', config).catch(() => null)
    if (r?.ok) toast.success('Branding saved')
    else toast.error('Failed to save')
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Branding" />
        <LoadingState rows={6} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Branding" description="Installer app colors and app name" actions={<Button onClick={handleSave}>Save Branding</Button>} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Colors</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {COLOR_FIELDS.map(f => (
              <div key={f.key} className="flex items-center justify-between gap-4">
                <Label className="shrink-0">{f.label}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config[f.key]}
                    onChange={e => setConfig(p => ({ ...p, [f.key]: e.target.value }))}
                    className="h-8 w-10 cursor-pointer border-0 p-0"
                  />
                  <Input
                    value={config[f.key]}
                    onChange={e => {
                      const v = e.target.value
                      if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setConfig(p => ({ ...p, [f.key]: v }))
                    }}
                    className="font-mono w-28 h-8"
                  />
                </div>
              </div>
            ))}
            <div>
              <Label>App Name</Label>
              <Input value={config.appName} onChange={e => setConfig(p => ({ ...p, appName: e.target.value }))} className="mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Preview</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-lg p-6" style={{ background: config.gunmetal, color: config.white }}>
              <div className="rounded-md px-4 py-2 font-semibold mb-3" style={{ background: config.primary, color: config.white }}>
                {config.appName}
              </div>
              <div className="flex gap-2 mb-3">
                <span className="text-xs px-3 py-1 rounded" style={{ background: config.secondary, color: '#fff' }}>EN</span>
                <span className="text-xs px-3 py-1 rounded" style={{ background: config.accent, color: '#333' }}>Photo Checklist</span>
              </div>
              <div className="h-28 rounded mb-2" style={{ background: config.grey }} />
              <div className="rounded p-2 text-sm" style={{ background: config.white, color: '#333' }}>
                Preview of the installer interface
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
