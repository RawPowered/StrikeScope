import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent } from '../components/ui/card'

export default function VerifyMfa() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const mfaToken = localStorage.getItem('mfa_token')

  useEffect(() => {
    if (!mfaToken) navigate('/')
  }, [mfaToken, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code || !mfaToken) return
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/auth/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, code }),
      })
      const data = await r.json()
      if (data.ok && data.data) {
        localStorage.removeItem('mfa_token')
        let isCustomer = false
        try {
          const payload = JSON.parse(atob(mfaToken.split('.')[1]))
          isCustomer = !!payload.projectId
        } catch { /* ignore malformed MFA token payload */ }
        if (isCustomer) {
          localStorage.setItem('customer_jwt', data.data.token)
          navigate('/customer/dashboard')
        } else {
          localStorage.setItem('jwt', data.data.token)
          navigate('/')
        }
      } else {
        setError(data.error || 'Verification failed')
      }
    } catch { setError('Network error') }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gunmetal p-4">
      <Card className="w-full max-w-md border-sidebar-border bg-sidebar shadow-2xl">
        <CardContent className="pt-8 pb-8">
          <div className="text-center mb-6">
            <h1 className="text-lg font-semibold text-foreground">Two-Factor Authentication</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter the code from your authenticator app</p>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="mfa-code">Authentication Code</Label>
              <Input
                id="mfa-code"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
                className="mt-1 text-center tracking-widest bg-background"
                autoFocus
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
