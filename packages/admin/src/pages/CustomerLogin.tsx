import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent } from '../components/ui/card'

export default function CustomerLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password || !accessKey) { setError('All fields required'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/auth/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, accessKey }),
      })
      const data = await r.json()
      if (data.ok && data.data) {
        localStorage.setItem('customer_jwt', data.data.token)
        navigate('/customer/dashboard')
      } else if (data.mfaRequired) {
        localStorage.setItem('mfa_token', data.mfaToken)
        navigate('/verify-mfa')
      } else {
        setError(data.error || 'Login failed')
      }
    } catch { setError('Network error') }
    setLoading(false)
  }

  return (
    <Card className="max-w-md mx-auto mt-12">
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold text-center mb-6">Customer Login</h2>
        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" className="mt-1" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" className="mt-1" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="accessKey">Access Key</Label>
            <Input id="accessKey" value={accessKey} onChange={e => setAccessKey(e.target.value)} placeholder="6-digit key" maxLength={6} className="mt-1" required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Logging in…' : 'Login'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
