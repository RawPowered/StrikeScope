import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setFieldToken } from '../api'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/field/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }).then(res => res.json())
      if (r.ok && r.data?.token) {
        setFieldToken(r.data.token)
        navigate('/jobs')
      } else {
        setError(r.error || 'Login failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ paddingTop: 48 }}>
      <h1 style={{ marginBottom: 8 }}>Field Login</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Foreman, crew, and technician access</p>
      {error && <div className="error">{error}</div>}
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
        <button type="submit" className="btn" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  )
}
