import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api'
import { useConfirm } from '../components/ConfirmDialog'
import { PageHeader } from '../layout/PageHeader'
import { FormDialog } from '../components/ViewToggle'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { LoadingState } from '../components/EmptyState'

interface Role {
  id: string; companyId: string; name: string; description: string | null
  isSystem: boolean; createdAt: string; userCount: number
  permissions?: Permission[]
  isEnabled?: boolean
}

interface Permission {
  id: string; roleId: string; entity: string
  canView: number; canCreate: number; canEdit: number; canDelete: number
}

interface FieldPerm {
  id?: string; roleId?: string; entity: string; field: string
  canView: number; canEdit: number
}

interface SensitiveField { entity: string; field: string }

const ENTITIES = ['leads', 'customers', 'projects', 'contacts', 'submissions', 'settings', 'users', 'audit']
const ACTIONS = ['canView', 'canCreate', 'canEdit', 'canDelete'] as const
const ACTION_LABELS: Record<string, string> = {
  canView: 'View', canCreate: 'Create', canEdit: 'Edit', canDelete: 'Delete',
}

export default function Roles() {
  const confirm = useConfirm()
  const [roles, setRoles] = useState<Role[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editPerms, setEditPerms] = useState<Permission[]>([])
  const [sensitiveFields, setSensitiveFields] = useState<SensitiveField[]>([])
  const [editFieldPerms, setEditFieldPerms] = useState<FieldPerm[]>([])
  const [loading, setLoading] = useState(true)
  const [newRoleName, setNewRoleName] = useState('')
  const [editingRole, setEditingRole] = useState<{ id: string; name: string; description: string } | null>(null)

  useEffect(() => {
    api.get<SensitiveField[]>('/api/admin/roles/fields/config').then(r => {
      if (r.ok && r.data) setSensitiveFields(r.data)
    })
  }, [])

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get<Role[]>('/api/admin/roles'),
      api.get<{ companyId: string; roleId: string; isEnabled: boolean }[]>('/api/admin/roles/enabled'),
    ]).then(([rr, er]) => {
      if (rr.ok && rr.data) {
        const enabledMap = new Map((er.data || []).map(e => [e.roleId, e.isEnabled]))
        setRoles(rr.data.map(r => ({ ...r, isEnabled: enabledMap.get(r.id) ?? true })))
      }
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const expandRole = async (role: Role) => {
    if (expanded === role.id) { setExpanded(null); return }
    setExpanded(role.id)
    const [r, fr] = await Promise.all([
      api.get<Role>(`/api/admin/roles/${role.id}`),
      api.get<FieldPerm[]>(`/api/admin/roles/${role.id}/field-permissions`),
    ])
    if (r.ok && r.data?.permissions) setEditPerms(r.data.permissions)
    if (fr.ok && fr.data) setEditFieldPerms(fr.data)
  }

  const togglePerm = (entity: string, action: string) => {
    setEditPerms(prev =>
      prev.map(p => p.entity === entity ? { ...p, [action]: p[action as keyof Permission] ? 0 : 1 } : p)
    )
  }

  const toggleFieldPerm = (entity: string, field: string, key: 'canView' | 'canEdit') => {
    setEditFieldPerms(prev => {
      const idx = prev.findIndex(p => p.entity === entity && p.field === field)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], [key]: next[idx][key] ? 0 : 1 }
        return next
      }
      return [...prev, { entity, field, [key]: 1, canView: key === 'canView' ? 1 : 0, canEdit: key === 'canEdit' ? 1 : 0 }]
    })
  }

  const savePerms = async (roleId: string) => {
    const perms = editPerms.map(p => ({ entity: p.entity, canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete }))
    const r = await api.put(`/api/admin/roles/${roleId}/permissions`, { permissions: perms })
    if (r.ok) { toast.success('Permissions saved'); load() }
    else toast.error(r.error || 'Failed to save permissions')
  }

  const saveFieldPerms = async (roleId: string) => {
    const perms = editFieldPerms.map(p => ({ entity: p.entity, field: p.field, canView: p.canView, canEdit: p.canEdit }))
    const r = await api.put(`/api/admin/roles/${roleId}/field-permissions`, { permissions: perms })
    if (r.ok) toast.success('Field permissions saved')
    else toast.error(r.error || 'Failed to save field permissions')
  }

  const toggleEnabled = (roleId: string) => {
    setRoles(prev => prev.map(r => r.id === roleId ? { ...r, isEnabled: !r.isEnabled } : r))
  }

  const saveEnabledRoles = async () => {
    const rolesData = roles.map(r => ({ roleId: r.id, isEnabled: r.isEnabled ?? true }))
    const r = await api.put('/api/admin/roles/enabled', { roles: rolesData })
    if (r.ok) toast.success('Role toggles saved')
    else toast.error(r.error || 'Failed to save')
  }

  const handleCreate = async () => {
    if (!newRoleName.trim()) return
    const r = await api.post('/api/admin/roles', { name: newRoleName.trim() })
    if (r.ok) { toast.success('Role created'); setNewRoleName(''); load() }
    else toast.error(r.error || 'Failed to create role')
  }

  const handleUpdate = async () => {
    if (!editingRole) return
    const r = await api.put(`/api/admin/roles/${editingRole.id}`, { name: editingRole.name, description: editingRole.description })
    if (r.ok) { toast.success('Role updated'); setEditingRole(null); load() }
    else toast.error(r.error || 'Failed to update role')
  }

  const handleDelete = async (role: Role) => {
    const ok = await confirm({ title: 'Delete role?', description: `"${role.name}" cannot be undone.`, variant: 'destructive', confirmLabel: 'Delete' })
    if (!ok) return
    const r = await api.del(`/api/admin/roles/${role.id}`)
    if (r.ok) { toast.success('Deleted'); load() }
    else toast.error(r.error || 'Failed to delete role')
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Roles & Permissions" />
        <LoadingState rows={5} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        description="Define roles and permissions for company users"
        actions={<Button variant="outline" onClick={saveEnabledRoles}>Save Role Toggles</Button>}
      />

      <Card className="mb-4 border-amber-200 bg-amber-50">
        <CardContent className="py-3 text-sm text-amber-900">
          <strong>User (Template):</strong> The &quot;User&quot; role is disabled-by-default. Enable it below to assign users the default role.
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="pt-4 flex gap-3 items-center">
          <Input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="New role name…" className="flex-1" />
          <Button onClick={handleCreate}>Create Role</Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {roles.map(role => (
          <Card key={role.id}>
            <CardContent className="p-0">
              <button
                type="button"
                className="w-full flex justify-between items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
                onClick={() => expandRole(role)}
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{role.name}</span>
                    {role.isSystem && <Badge variant="secondary">System</Badge>}
                    {role.name === 'User' && <Badge variant="outline">Template</Badge>}
                    {role.isEnabled === false && <Badge variant="destructive">Disabled</Badge>}
                    <span className="text-xs text-muted-foreground">{role.userCount} user(s)</span>
                  </div>
                  {role.description && <p className="text-xs text-muted-foreground mt-1">{role.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                  {!role.isSystem && (
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={role.isEnabled !== false} onChange={() => toggleEnabled(role.id)} />
                      Active
                    </label>
                  )}
                  {!role.isSystem && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setEditingRole({ id: role.id, name: role.name, description: role.description || '' })}>Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(role)}>Del</Button>
                    </>
                  )}
                  <span className="text-muted-foreground text-xs">{expanded === role.id ? '▲' : '▼'}</span>
                </div>
              </button>

              {expanded === role.id && (
                <div className="border-t border-border p-4 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-2 font-medium">Entity</th>
                          {ACTIONS.map(a => (
                            <th key={a} className="text-center py-2 px-2 font-medium w-16">{ACTION_LABELS[a]}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ENTITIES.map(entity => {
                          const perm = editPerms.find(p => p.entity === entity)
                          return (
                            <tr key={entity} className="border-b border-border/50">
                              <td className="py-2 px-2 capitalize">{entity}</td>
                              {ACTIONS.map(action => (
                                <td key={action} className="text-center py-2 px-2">
                                  <input type="checkbox" checked={!!perm?.[action as keyof Permission]} onChange={() => togglePerm(entity, action)} />
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Button size="sm" onClick={() => savePerms(role.id)}>Save Permissions</Button>

                  {sensitiveFields.length > 0 && (
                    <>
                      <h4 className="text-sm font-medium">Field-Level Permissions</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-2 font-medium">Entity</th>
                              <th className="text-left py-2 px-2 font-medium">Field</th>
                              <th className="text-center py-2 px-2 font-medium w-16">View</th>
                              <th className="text-center py-2 px-2 font-medium w-16">Edit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sensitiveFields.map(sf => {
                              const fp = editFieldPerms.find(p => p.entity === sf.entity && p.field === sf.field)
                              return (
                                <tr key={`${sf.entity}-${sf.field}`} className="border-b border-border/50">
                                  <td className="py-2 px-2 capitalize">{sf.entity}</td>
                                  <td className="py-2 px-2">{sf.field}</td>
                                  <td className="text-center py-2 px-2">
                                    <input type="checkbox" checked={!!fp?.canView} onChange={() => toggleFieldPerm(sf.entity, sf.field, 'canView')} />
                                  </td>
                                  <td className="text-center py-2 px-2">
                                    <input type="checkbox" checked={!!fp?.canEdit} onChange={() => toggleFieldPerm(sf.entity, sf.field, 'canEdit')} />
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <Button size="sm" onClick={() => saveFieldPerms(role.id)}>Save Field Permissions</Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <FormDialog open={!!editingRole} title="Edit Role" onClose={() => setEditingRole(null)} footer={
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setEditingRole(null)}>Cancel</Button>
          <Button onClick={handleUpdate}>Save</Button>
        </div>
      }>
        {editingRole && (
          <div className="space-y-3">
            <div><Label>Name</Label><Input className="mt-1" value={editingRole.name} onChange={e => setEditingRole(p => p ? { ...p, name: e.target.value } : null)} /></div>
            <div><Label>Description</Label><Input className="mt-1" value={editingRole.description} onChange={e => setEditingRole(p => p ? { ...p, description: e.target.value } : null)} /></div>
          </div>
        )}
      </FormDialog>
    </div>
  )
}
