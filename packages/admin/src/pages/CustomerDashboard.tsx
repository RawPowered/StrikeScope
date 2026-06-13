import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { LoadingState, EmptyState } from '../components/EmptyState'

interface CustomerProject {
  id: string; name: string; status: string; createdAt: string
  projectTypeName?: string; customerName?: string
  items?: { id: string; label: string; titleEn: string }[]
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success'> = {
  active: 'default',
  completed: 'success',
  planned: 'secondary',
}

export default function CustomerDashboard() {
  const navigate = useNavigate()
  const [project, setProject] = useState<CustomerProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('customer_jwt')
    if (!token) { navigate('/customer/login'); return }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.data?.projectId) {
          return fetch(`/api/admin/projects/${data.data.projectId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        }
        throw new Error('No project linked to this account')
      })
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.data) setProject(data.data)
        else setError('No project found')
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [navigate])

  const logout = () => {
    localStorage.removeItem('customer_jwt')
    navigate('/customer/login')
  }

  if (loading) return <LoadingState rows={4} />
  if (error || !project) {
    return <EmptyState title={error || 'No project found'} action={<Button variant="outline" onClick={logout}>Sign Out</Button>} />
  }

  return (
    <div>
      <PageHeader
        title="Your Project"
        actions={<Button variant="outline" size="sm" onClick={logout}>Sign Out</Button>}
      />

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{project.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Badge variant={STATUS_VARIANT[project.status] || 'secondary'}>{project.status}</Badge>
          {project.projectTypeName && (
            <p className="text-sm text-muted-foreground">Type: {project.projectTypeName}</p>
          )}
          <p className="text-xs text-muted-foreground">Created {new Date(project.createdAt).toLocaleDateString()}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Task Progress</CardTitle></CardHeader>
        <CardContent>
          {project.items && project.items.length > 0 ? (
            <div className="space-y-2">
              {project.items.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground font-mono text-xs">{item.label}</span>
                  <span>{item.titleEn}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
