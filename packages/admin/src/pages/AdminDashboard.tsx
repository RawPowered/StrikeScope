import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { useAuth } from '../auth'
import { useConfirm } from '../components/ConfirmDialog'
import { PageHeader } from '../layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Skeleton } from '../components/ui/skeleton'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const { user } = useAuth()
  const [stats, setStats] = useState({ users: 0, roles: 0, stages: 0, jurisdictionPending: 0 })
  const [sandbox, setSandbox] = useState<{ isSandbox: boolean; leads: number; customers: number; projects: number } | null>(null)
  const [resetting, setResetting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaLoading, setMfaLoading] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get<any[]>('/api/admin/users'),
      api.get<any[]>('/api/admin/roles'),
      api.get<any[]>('/api/admin/lead-stages'),
      api.get<any[]>('/api/admin/geo/jurisdiction-requests?status=pending'),
    ]).then(([u, r, s, j]) => {
      setStats({
        users: (u.data || []).length,
        roles: (r.data || []).length,
        stages: (s.data || []).length,
        jurisdictionPending: (j.data || []).length,
      })
    }).finally(() => setLoading(false))

    if (user?.companyId) {
      api.get<any>(`/api/admin/companies/${user.companyId}`).then(r => {
        if (r.ok && r.data) setMfaEnabled(!!r.data.mfaEnabled)
      })
    }
  }, [user?.companyId])

  useEffect(() => {
    if (!user?.companyId) return
    const token = localStorage.getItem('jwt')
    if (!token) return
    const apiBase = import.meta.env.VITE_API_URL || ''
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = apiBase ? new URL(apiBase, window.location.origin).host : window.location.host
    const ws = new WebSocket(`${proto}//${host}/ws/admin?token=${encodeURIComponent(token)}`)
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as { type?: string; data?: { companyId?: string; count?: number } }
        if (msg.type === 'jurisdiction-pending' && msg.data?.companyId === user.companyId && typeof msg.data.count === 'number') {
          setStats(s => ({ ...s, jurisdictionPending: msg.data!.count! }))
        }
      } catch { /* ignore */ }
    }
    return () => ws.close()
  }, [user?.companyId])

  useEffect(() => {
    if (!user?.companyId) return
    api.get<{ isSandbox: boolean; leads: number; customers: number; projects: number }>('/api/admin/test-workspace/status')
      .then(r => { if (r.ok && r.data) setSandbox(r.data) })
  }, [user?.companyId])

  const resetTestData = async () => {
    if (!sandbox?.isSandbox) return
    const ok = await confirm({
      title: 'Clear test CRM data?',
      description: 'Deletes all leads, customers, projects, and related records in this workspace. Roles, stages, and settings stay intact.',
      variant: 'destructive',
      confirmLabel: 'Clear test data',
    })
    if (!ok) return
    setResetting(true)
    const r = await api.post<{ cleared: { leads: number; customers: number; projects: number } }>('/api/admin/test-workspace/reset').catch(() => null)
    setResetting(false)
    if (r?.ok && r.data) {
      toast.success(`Cleared ${r.data.cleared.leads} leads, ${r.data.cleared.customers} customers, ${r.data.cleared.projects} projects`)
      await queryClient.invalidateQueries({ queryKey: ['leads'] })
      await queryClient.invalidateQueries({ queryKey: ['customers'] })
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      const s = await api.get<typeof sandbox>('/api/admin/test-workspace/status')
      if (s.ok && s.data) setSandbox(s.data)
    } else toast.error(r?.error || 'Reset failed')
  }

  const toggleMfa = async () => {
    if (!user?.companyId) return
    setMfaLoading(true)
    const newVal = !mfaEnabled
    const r = await api.put(`/api/admin/companies/${user.companyId}/mfa`, { mfaEnabled: newVal })
    if (r.ok) {
      setMfaEnabled(newVal)
      toast.success(newVal ? 'MFA enabled for this company' : 'MFA disabled')
    } else {
      toast.error(r.error || 'Failed to update MFA')
    }
    setMfaLoading(false)
  }

  const generateQr = async () => {
    if (!user?.id) return
    setShowQr(true)
    const r = await api.post<{ secret: string; otpauth_url: string }>('/api/auth/totp/generate', { userId: user.id })
    if (r.ok && r.data) {
      setSecret(r.data.secret)
      const url = await QRCode.toDataURL(r.data.otpauth_url, { width: 200, margin: 2 })
      setQrDataUrl(url)
    } else {
      toast.error(r.error || 'Failed to generate secret')
    }
  }

  const verifyTotp = async () => {
    if (!user?.id || !verifyCode) return
    setVerifyLoading(true)
    const r = await api.post('/api/auth/totp/verify-setup', { userId: user.id, code: verifyCode })
    if (r.ok) {
      toast.success('Authenticator verified')
      setShowQr(false)
      setVerifyCode('')
    } else {
      toast.error(r.error || 'Verification failed')
    }
    setVerifyLoading(false)
  }

  const links = [
    { label: 'Pipeline Stages', path: '/company/admin/lead-stages', count: stats.stages },
    { label: 'Users', path: '/company/admin/users', count: stats.users },
    { label: 'Roles & Permissions', path: '/company/admin/roles', count: stats.roles },
    { label: 'Module Control', path: '/company/admin/custom-fields' },
    { label: 'Audit Trail', path: '/company/admin/audit' },
    { label: 'Branding', path: '/company/admin/branding' },
    { label: 'Connections', path: '/company/admin/connections' },
    { label: 'Photo Guide', path: '/company/admin/guide' },
    { label: 'Territory', path: '/company/admin/territory' },
    { label: 'Jurisdiction Requests', path: '/company/admin/jurisdiction-requests', count: stats.jurisdictionPending },
    { label: 'Contact Categories', path: '/company/admin/contact-categories' },
    { label: 'Bank Names', path: '/company/admin/banks' },
  ]

  return (
    <div>
      <PageHeader title="Admin Dashboard" description="Manage company settings, roles, and configurations." />

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {links.map(link => (
            <Card
              key={link.path}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigate(link.path)}
            >
              <CardContent className="pt-4 text-center">
                <p className="text-sm font-medium">{link.label}</p>
                {link.count !== undefined && (
                  <p className="text-2xl font-bold text-primary mt-2 tabular-nums">{link.count}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {sandbox?.isSandbox && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Test Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Default Workspace is a sandbox company — CRM data behaves like production but can be wiped for clean testing.
            </p>
            <p className="text-sm tabular-nums">
              {sandbox.leads} leads · {sandbox.customers} customers · {sandbox.projects} projects
            </p>
            <Button variant="destructive" size="sm" onClick={resetTestData} disabled={resetting}>
              {resetting ? 'Clearing…' : 'Clear test CRM data'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">MFA / Two-Factor Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Require all users to enter a code from their authenticator app when logging in.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant={mfaEnabled ? 'destructive' : 'default'} onClick={toggleMfa} disabled={mfaLoading}>
              {mfaLoading ? 'Saving…' : mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
            </Button>
            <span className={`text-sm ${mfaEnabled ? 'text-green-700' : 'text-muted-foreground'}`}>
              {mfaEnabled ? 'MFA is enabled' : 'MFA is disabled'}
            </span>
          </div>

          <hr className="border-border" />

          <div>
            <h4 className="text-sm font-medium mb-1">Your Authenticator Setup</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Scan the QR code with Google Authenticator or any TOTP-compatible app.
            </p>
            {!showQr ? (
              <Button variant="outline" size="sm" onClick={generateQr}>Setup Authenticator</Button>
            ) : (
              <div className="space-y-3">
                {qrDataUrl ? (
                  <div>
                    <img src={qrDataUrl} alt="QR Code" className="w-[200px] h-[200px] rounded-lg border border-border" />
                    <p className="text-xs text-muted-foreground mt-2">Secret: <code className="font-mono">{secret}</code></p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Generating QR code…</p>
                )}
                <div className="flex gap-2 items-end flex-wrap">
                  <div>
                    <Label htmlFor="totp-code">6-digit code</Label>
                    <Input
                      id="totp-code"
                      value={verifyCode}
                      onChange={e => setVerifyCode(e.target.value)}
                      placeholder="000000"
                      maxLength={6}
                      className="mt-1 w-40"
                    />
                  </div>
                  <Button size="sm" onClick={verifyTotp} disabled={verifyLoading || !verifyCode}>
                    {verifyLoading ? 'Verifying…' : 'Verify'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowQr(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
