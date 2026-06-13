import { useState, useEffect } from 'react'
import { useAuth } from '../auth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent } from '../components/ui/card'

export default function Login() {
  const { login, selectCompany, user, loading, workspaceSelection } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && user) window.location.href = '/'
  }, [user, loading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const err = await login(email, password)
    if (err) setError(err)
    setBusy(false)
  }

  if (loading) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-gunmetal p-4">
      <Card className="w-full max-w-md border-sidebar-border bg-sidebar shadow-2xl">
        <CardContent className="pt-8 pb-8">
          <div className="text-center mb-8">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white font-bold text-sm mb-3">SS</div>
            <h1 className="text-xl font-bold text-primary">StrikeScope</h1>
            <p className="text-sm text-muted-foreground mt-1">Company CRM</p>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {workspaceSelection ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">Choose workspace</p>
              {workspaceSelection.memberships.map(m => (
                <button
                  key={m.companyId}
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    const err = await selectCompany(m.companyId)
                    if (err) setError(err)
                    setBusy(false)
                  }}
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-left text-foreground hover:bg-muted transition-colors"
                >
                  <span className="font-medium block text-foreground">{m.companyName}</span>
                  <span className="text-xs text-muted-foreground">{m.roleName || m.role}</span>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" className="mt-1 bg-background" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@strikescope.local" autoFocus required />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" className="mt-1 bg-background" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
