import { useEffect, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { api } from '../api'
import { useAuth } from '../auth'
import { PageHeader } from '../layout/PageHeader'
import { DataTable } from '../components/data-table/DataTable'
import { FormDialog } from '../components/ViewToggle'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import type { Role } from '@strikescope/shared/src/types'

interface UserRow {
  id: string; companyId: string | null; email: string; name: string
  role: string; roleId: string | null; roleName: string | null
  isActive: boolean; createdAt: string
}

export default function Users() {
  const { user } = useAuth()
  const isSuper = user?.role === 'server_admin'
  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', password: '', roleId: '', companyId: '' })
  const [editing, setEditing] = useState<{ id: string; roleId: string; isActive: boolean } | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get<UserRow[]>('/api/admin/users'),
      api.get<Role[]>('/api/admin/roles'),
    ]).then(([u, r]) => {
      if (u.ok && u.data) setUsers(u.data)
      if (r.ok && r.data) setRoles(r.data)
    }).catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const companyRoles = isSuper ? roles : roles.filter(r => r.companyId === user?.companyId)

  const handleCreate = async () => {
    if (!form.email || !form.name || !form.password) return
    const payload: Record<string, string | null> = { ...form }
    if (isSuper) payload.companyId = form.companyId || null
    const r = await api.post('/api/admin/users', payload).catch(() => null)
    if (r?.ok) {
      toast.success('User created')
      setShowForm(false)
      setForm({ email: '', name: '', password: '', roleId: '', companyId: '' })
      load()
    } else {
      toast.error(r?.error || 'Failed to create user')
    }
  }

  const handleUpdate = async () => {
    if (!editing) return
    const r = await api.put(`/api/admin/users/${editing.id}`, { roleId: editing.roleId || null, isActive: editing.isActive })
    if (r?.ok) {
      toast.success('User updated')
      setEditing(null)
      load()
    } else {
      toast.error(r?.error || 'Failed to update user')
    }
  }

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.name}</span>
          <span className="text-muted-foreground ml-2 text-xs">{row.original.email}</span>
        </div>
      ),
    },
    {
      accessorKey: 'roleName',
      header: 'Role',
      cell: ({ row }) => <Badge variant="secondary">{row.original.roleName || row.original.role}</Badge>,
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => row.original.isActive
        ? <Badge variant="success">Active</Badge>
        : <Badge variant="outline">Inactive</Badge>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing({ id: row.original.id, roleId: row.original.roleId || '', isActive: row.original.isActive })}
        >
          Edit
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Users"
        description={`${users.length} user${users.length === 1 ? '' : 's'}`}
        actions={<Button onClick={() => setShowForm(true)}>+ Add User</Button>}
      />

      <DataTable data={users} columns={columns} loading={loading} emptyMessage="No users found." />

      <FormDialog open={showForm} title="New User" onClose={() => setShowForm(false)} footer={
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Save</Button>
        </div>
      }>
        <div className="space-y-3">
          <div><Label>Email</Label><Input type="email" className="mt-1" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
          <div><Label>Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><Label>Password</Label><Input type="password" className="mt-1" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
          <div>
            <Label>Role</Label>
            <Select value={form.roleId} onChange={e => setForm(p => ({ ...p, roleId: e.target.value }))} className="mt-1">
              <option value="">— Select Role —</option>
              {companyRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </div>
          {isSuper && (
            <div>
              <Label>Company</Label>
              <Select value={form.companyId} onChange={e => setForm(p => ({ ...p, companyId: e.target.value }))} className="mt-1">
                <option value="">— None (super admin) —</option>
                {roles.filter((v, i, a) => a.findIndex(t => t.companyId === v.companyId) === i).map(r => (
                  <option key={r.companyId} value={r.companyId}>{r.companyId}</option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </FormDialog>

      <FormDialog open={!!editing} title="Edit User" onClose={() => setEditing(null)} footer={
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          <Button onClick={handleUpdate}>Save</Button>
        </div>
      }>
        {editing && (
          <div className="space-y-3">
            <div>
              <Label>Role</Label>
              <Select value={editing.roleId} onChange={e => setEditing(p => p ? { ...p, roleId: e.target.value } : null)} className="mt-1">
                <option value="">— No Role —</option>
                {companyRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.isActive} onChange={e => setEditing(p => p ? { ...p, isActive: e.target.checked } : null)} />
              Active
            </label>
          </div>
        )}
      </FormDialog>
    </div>
  )
}
