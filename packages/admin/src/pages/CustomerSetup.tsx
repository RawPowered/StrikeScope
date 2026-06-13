import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent } from '../components/ui/card'

export default function CustomerSetup() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!token) { setError('Invalid setup link'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/auth/customer/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await r.json()
      if (data.ok) setDone(true)
      else setError(data.error || 'Setup failed')
    } catch { setError('Network error') }
    setLoading(false)
  }

  if (!token) {
    return (
      <div className="text-center text-destructive text-sm py-12">Invalid setup link. No token provided.</div>
    )
  }

  if (done) {
    return (
      <Card className="max-w-md mx-auto mt-12 text-center">
        <CardContent className="pt-8 pb-8">
          <h2 className="text-lg font-semibold mb-2">Account Created!</h2>
          <p className="text-sm text-muted-foreground mb-4">You can now log in with your email and password.</p>
          <Button onClick={() => navigate('/customer/login')}>Go to Login</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-md mx-auto mt-12">
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold text-center mb-6">Set Up Your Password</h2>
        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password">New Password</Label>
            <Input id="password" type="password" className="mt-1" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm Password</Label>
            <Input id="confirm" type="password" className="mt-1" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={6} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Setting up…' : 'Set Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
