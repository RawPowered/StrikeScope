import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { User, UserMembership } from '@strikescope/shared/src/types'
import { DEV_ADMIN_EMAIL } from '@strikescope/shared/src/brand'
import { LoadingState, EmptyState } from './components/EmptyState'

const SENSITIVE_FIELDS = new Set(['co_signer_name', 'co_signer_email', 'co_signer_phone', 'ssn_last_four', 'date_of_birth', 'photo_id', 'co_signer_contact_id'])
export const ACTIVE_COMPANY_KEY = 'activeCompanyId'

interface AuthState {
  token: string | null
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<string | null>
  selectCompany: (companyId: string) => Promise<string | null>
  switchCompany: (companyId: string | null) => Promise<string | null>
  logout: () => void
  workspaceSelection: { token: string; memberships: UserMembership[] } | null
  can: (entity: string, action?: 'view' | 'create' | 'edit' | 'delete') => boolean
  canViewField: (entity: string, field: string) => boolean
  canEditField: (entity: string, field: string) => boolean
}

const AuthContext = createContext<AuthState>({
  token: null, user: null, loading: true,
  login: async () => null,
  selectCompany: async () => null,
  switchCompany: async () => null,
  logout: () => {},
  workspaceSelection: null,
  can: () => false,
  canViewField: () => false,
  canEditField: () => false,
})

export function AuthProvider({ children, apiBase }: { children: ReactNode; apiBase: string }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('jwt'))
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [workspaceSelection, setWorkspaceSelection] = useState<{ token: string; memberships: UserMembership[] } | null>(null)
  const resolvingRef = useRef(false)

  const applySession = useCallback((data: any) => {
    localStorage.setItem('jwt', data.token)
    setToken(data.token)
    const nextUser = { ...data.user, permissions: data.permissions }
    setUser(nextUser)
    if (nextUser.companyId) {
      localStorage.setItem(ACTIVE_COMPANY_KEY, nextUser.companyId)
    } else {
      localStorage.removeItem(ACTIVE_COMPANY_KEY)
    }
    setWorkspaceSelection(null)
    return nextUser
  }, [])

  const switchCompanyRequest = useCallback(async (companyId: string | null, authToken: string | null): Promise<{ ok: boolean; data?: any; error?: string }> => {
    try {
      const r = await fetch(`${apiBase}/api/auth/switch-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ companyId }),
      })
      return await r.json()
    } catch {
      return { ok: false, error: 'Network error' }
    }
  }, [apiBase])

  const ensureCompanyContext = useCallback(async (userData: User, authToken: string): Promise<User> => {
    if (userData.companyId) return userData
    // server_admin lands in Server Admin nav until they explicitly enter a workspace
    if (userData.role === 'server_admin') return userData
    const memberships = userData.memberships || []
    if (!memberships.length) return userData

    const stored = localStorage.getItem(ACTIVE_COMPANY_KEY)
    const targetId = stored && memberships.some(m => m.companyId === stored)
      ? stored
      : memberships[0].companyId

    const result = await switchCompanyRequest(targetId, authToken)
    if (result.ok && result.data) return applySession(result.data) as User
    return userData
  }, [applySession, switchCompanyRequest])

  const devBypass = useCallback(async () => {
    if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) return false
    try {
      const r = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: DEV_ADMIN_EMAIL, password: 'admin' }),
      })
      const data = await r.json()
      if (data.ok && data.data) {
        const nextUser = applySession(data.data)
        if (!nextUser.companyId && nextUser.role !== 'server_admin') {
          await ensureCompanyContext(nextUser, data.data.token)
        }
        return true
      }
    } catch { /* fall through */ }
    return false
  }, [apiBase, applySession, ensureCompanyContext])

  useEffect(() => {
    if (!token) {
      devBypass().then(ok => { if (!ok) setLoading(false) }).catch(() => setLoading(false))
      return
    }
    if (resolvingRef.current) return
    resolvingRef.current = true
    fetch(`${apiBase}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(async r => {
        if (r.ok && r.refreshedSession) {
          applySession(r.refreshedSession)
          return
        }
        if (r.ok && r.data) {
          const resolved = await ensureCompanyContext(r.data, token)
          setUser({ ...resolved, permissions: r.data.permissions })
        } else {
          localStorage.removeItem('jwt')
          setToken(null)
        }
      })
      .catch(() => { localStorage.removeItem('jwt'); setToken(null) })
      .finally(() => { resolvingRef.current = false; setLoading(false) })
  }, [token, apiBase, ensureCompanyContext, devBypass])

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const r = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await r.json()
      if (data.ok && data.data) {
        const nextUser = applySession(data.data)
        if (!nextUser.companyId && nextUser.role !== 'server_admin') {
          await ensureCompanyContext(nextUser, data.data.token)
        }
        return null
      }
      if (data.workspaceSelectionRequired) {
        setWorkspaceSelection({ token: data.selectionToken, memberships: data.memberships || [] })
        return null
      }
      if (data.mfaRequired) {
        localStorage.setItem('mfa_token', data.mfaToken)
        window.location.href = '/verify-mfa'
        return null
      }
      return data.error || 'Login failed'
    } catch {
      return 'Network error'
    }
  }, [apiBase, applySession, ensureCompanyContext])

  const selectCompany = useCallback(async (companyId: string): Promise<string | null> => {
    if (!workspaceSelection) return 'No workspace selection is pending'
    try {
      const r = await fetch(`${apiBase}/api/auth/select-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectionToken: workspaceSelection.token, companyId }),
      })
      const data = await r.json()
      if (data.ok && data.data) {
        applySession(data.data)
        return null
      }
      if (data.mfaRequired) {
        localStorage.setItem('mfa_token', data.mfaToken)
        window.location.href = '/verify-mfa'
        return null
      }
      return data.error || 'Failed to select workspace'
    } catch {
      return 'Network error'
    }
  }, [apiBase, applySession, workspaceSelection])

  const switchCompany = useCallback(async (companyId: string | null): Promise<string | null> => {
    const result = await switchCompanyRequest(companyId, token)
    if (result.ok && result.data) {
      applySession(result.data)
      return null
    }
    return result.error || 'Failed to switch workspace'
  }, [applySession, switchCompanyRequest, token])

  const logout = useCallback(() => {
    localStorage.removeItem('jwt')
    localStorage.removeItem(ACTIVE_COMPANY_KEY)
    setToken(null)
    setUser(null)
    setWorkspaceSelection(null)
  }, [])

  const can = useCallback((entity: string, action: 'view' | 'create' | 'edit' | 'delete' = 'view'): boolean => {
    if (!user) return false
    if (user.role === 'server_admin') return true
    const perms = user.permissions?.[entity]
    if (!perms) return false
    const key = `can${action.charAt(0).toUpperCase() + action.slice(1)}` as keyof typeof perms
    return !!perms[key]
  }, [user])

  const canViewField = useCallback((entity: string, field: string): boolean => {
    if (!user) return false
    if (user.role === 'server_admin') return true
    const ep = user.permissions?.[entity]
    if (!ep?.canView) return false
    if (!SENSITIVE_FIELDS.has(field)) return true
    return ep.fields?.[field]?.canView ?? false
  }, [user])

  const canEditField = useCallback((entity: string, field: string): boolean => {
    if (!user) return false
    if (user.role === 'server_admin') return true
    const ep = user.permissions?.[entity]
    if (!ep?.canEdit) return false
    if (!SENSITIVE_FIELDS.has(field)) return true
    return ep.fields?.[field]?.canEdit ?? false
  }, [user])

  return (
    <AuthContext.Provider value={{ token, user, loading, login, selectCompany, switchCompany, logout, workspaceSelection, can, canViewField, canEditField }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export function ProtectedRoute({ children, roles, requirePermission }: {
  children: ReactNode; roles?: string[]; requirePermission?: { entity: string; action: 'view' | 'create' | 'edit' | 'delete' }
}) {
  const { user, loading, can } = useAuth()
  if (loading) return <LoadingState rows={6} />
  if (!user) {
    window.location.href = '/login'
    return null
  }
  if (roles && !roles.includes(user.role)) {
    return <EmptyState title="Access denied" description="Insufficient permissions for this page." />
  }
  if (requirePermission && !can(requirePermission.entity, requirePermission.action)) {
    return <EmptyState title="Access denied" description="Insufficient permissions for this page." />
  }
  return <>{children}</>
}
