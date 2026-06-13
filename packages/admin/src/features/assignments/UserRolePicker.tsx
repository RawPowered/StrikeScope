import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { Label } from '../../components/ui/label'
import { Select } from '../../components/ui/select'
import { Button } from '../../components/ui/button'

export interface ProjectAssignment { userId: string; role: string }

const ROLES = [
  { value: 'sales_agent', label: 'Sales Agent' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'sales_manager', label: 'Sales Manager' },
]

interface UserRow { id: string; name: string; email: string }

interface Props {
  value: ProjectAssignment[]
  onChange: (v: ProjectAssignment[]) => void
}

export function UserRolePicker({ value, onChange }: Props) {
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const r = await api.get<UserRow[]>('/api/admin/users')
      return r.ok && r.data ? r.data : []
    },
  })

  const add = () => onChange([...value, { userId: '', role: 'sales_agent' }])
  const update = (i: number, patch: Partial<ProjectAssignment>) => {
    const next = [...value]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center"><Label>Team assignments</Label><Button type="button" size="sm" variant="outline" onClick={add}>+ Add</Button></div>
      {value.map((a, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Select className="flex-1" value={a.userId} onChange={e => update(i, { userId: e.target.value })}>
            <option value="">— User —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <Select value={a.role} onChange={e => update(i, { role: e.target.value })}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
          <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>×</Button>
        </div>
      ))}
    </div>
  )
}
