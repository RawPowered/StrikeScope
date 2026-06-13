import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { api, clearFieldToken } from './api'
import Login from './pages/Login'
import Jobs from './pages/Jobs'
import ClockInPage from './pages/ClockIn'
import CalendarPage from './pages/Calendar'
import CapturePage from './pages/Capture'
import OverrideRequestPage from './pages/OverrideRequest'

function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isLogin = location.pathname === '/login'
  const logout = () => { clearFieldToken(); window.location.href = '/login' }

  if (isLogin) return <>{children}</>

  return (
    <div>
      <nav className="nav">
        <NavLink to="/jobs" className={({ isActive }) => isActive ? 'active' : ''}>Jobs</NavLink>
        <NavLink to="/clock-in" className={({ isActive }) => isActive ? 'active' : ''}>Clock In</NavLink>
        <NavLink to="/calendar" className={({ isActive }) => isActive ? 'active' : ''}>Calendar</NavLink>
        <NavLink to="/capture" className={({ isActive }) => isActive ? 'active' : ''}>Capture</NavLink>
        <NavLink to="/override" className={({ isActive }) => isActive ? 'active' : ''}>Override</NavLink>
        <button type="button" className="btn-outline" style={{ marginLeft: 'auto', width: 'auto' }} onClick={logout}>Logout</button>
      </nav>
      <div className="page">{children}</div>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    const token = localStorage.getItem('field_jwt')
    if (!token) { setOk(false); return }
    api.get('/api/auth/me').then(r => setOk(!!r.ok)).catch(() => setOk(false))
  }, [])
  if (ok === null) return <p style={{ padding: 24 }}>Loading…</p>
  if (!ok) return <Navigate to="/login" replace />
  return <>{children}</>
}

function CaptureGuard({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.get<{ session: any }>('/api/field/sessions/active').then(r => {
      setSession(r.ok ? r.data?.session : null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])
  if (loading) return <p>Checking session…</p>
  if (!session?.isActive) {
    return (
      <div className="warn">
        <strong>Return to worksite</strong>
        <p style={{ margin: '8px 0 0' }}>Clock in on site to capture photos or complete tasks. Calendar and job list remain available off-site.</p>
        <NavLink to="/clock-in" style={{ display: 'inline-block', marginTop: 12 }}>Go to Clock In</NavLink>
      </div>
    )
  }
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/jobs" element={<RequireAuth><Jobs /></RequireAuth>} />
          <Route path="/clock-in" element={<RequireAuth><ClockInPage /></RequireAuth>} />
          <Route path="/calendar" element={<RequireAuth><CalendarPage /></RequireAuth>} />
          <Route path="/capture" element={<RequireAuth><CaptureGuard><CapturePage /></CaptureGuard></RequireAuth>} />
          <Route path="/override" element={<RequireAuth><OverrideRequestPage /></RequireAuth>} />
          <Route path="/" element={<Navigate to="/jobs" replace />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  )
}
