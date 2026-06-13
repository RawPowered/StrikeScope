import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select } from '../../components/ui/select'
import { Badge } from '../../components/ui/badge'
import {
  useAutomationsStatus,
  useRegisterWebhook,
  useRotateServiceKey,
  useWebhooks,
} from './useAutomations'

export default function AutomationSetupPanel() {
  const { data: status } = useAutomationsStatus()
  const { data: webhooks = [] } = useWebhooks()
  const rotateKey = useRotateServiceKey()
  const registerWebhook = useRegisterWebhook()
  const [newKey, setNewKey] = useState<string | null>(null)
  const [triggerType, setTriggerType] = useState('lead_created')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [label, setLabel] = useState('')

  const handleRotate = async () => {
    try {
      const result = await rotateKey.mutateAsync()
      setNewKey(result.key)
      toast.success('Service key rotated — copy it now')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const handleRegister = async () => {
    if (!webhookUrl.trim()) {
      toast.error('Webhook URL is required')
      return
    }
    try {
      await registerWebhook.mutateAsync({ triggerType, webhookUrl: webhookUrl.trim(), label: label || undefined })
      setWebhookUrl('')
      setLabel('')
      toast.success('Webhook registered')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2 items-center">
            <span>Activepieces:</span>
            <Badge variant={status?.reachable ? 'default' : 'destructive'}>
              {status?.reachable ? 'Online' : 'Offline'}
            </Badge>
            {status?.activepiecesUrl && (
              <a href={status.activepiecesUrl} target="_blank" rel="noreferrer" className="text-orange-400 hover:underline">
                {status.activepiecesUrl}
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span>Embed SSO:</span>
            <Badge variant={status?.embedConfigured ? 'default' : 'secondary'}>
              {status?.embedConfigured ? 'Configured' : 'Not configured (use Open Automations)'}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Project ID: <code>{status?.externalProjectId}</code>
            {status?.serviceKeyPrefix && <> · Key prefix: <code>{status.serviceKeyPrefix}…</code></>}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Use this key in the StrikeScope piece connection inside Activepieces.
          </p>
          {newKey && (
            <div className="p-3 rounded bg-muted font-mono text-xs break-all">{newKey}</div>
          )}
          <Button onClick={handleRotate} disabled={rotateKey.isPending}>
            {status?.serviceKeyPrefix ? 'Rotate key' : 'Generate key'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Trigger</Label>
              <Select value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
                {(status?.triggerTypes || []).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Label (optional)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My flow" />
            </div>
            <div className="sm:col-span-2">
              <Label>Webhook URL (from Activepieces flow trigger)</Label>
              <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <Button onClick={handleRegister} disabled={registerWebhook.isPending}>Register webhook</Button>

          {webhooks.length > 0 && (
            <ul className="text-sm space-y-2 mt-4">
              {webhooks.map((w) => (
                <li key={w.id} className="border rounded p-2">
                  <div className="font-medium">{w.triggerType}</div>
                  <div className="text-xs text-muted-foreground truncate">{w.webhookUrl}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
