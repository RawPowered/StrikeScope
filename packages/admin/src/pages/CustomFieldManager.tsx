import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api'
import { useConfirm } from '../components/ConfirmDialog'
import { PageHeader } from '../layout/PageHeader'
import { ViewToggle } from '../components/ViewToggle'
import { FormDialog } from '../components/ViewToggle'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { LoadingState, EmptyState } from '../components/EmptyState'
import { useQuery } from '@tanstack/react-query'
import type { CustomFieldDefinition, CustomFieldType } from '@strikescope/shared/src/types'

const MODULES = ['leads', 'customers', 'contacts', 'agreements', 'projects', 'submissions', 'activities'] as const

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-Select' },
]

export default function CustomFieldManager() {
  const confirm = useConfirm()
  const [activeModule, setActiveModule] = useState<typeof MODULES[number]>('leads')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ fieldName: '', label: '', fieldType: 'text' as CustomFieldType, optionsJson: '', isRequired: false, carryOver: false, isEnabled: true })

  const { data: fields = [], isLoading, refetch } = useQuery({
    queryKey: ['custom-fields', activeModule],
    queryFn: async () => {
      const r = await api.get<CustomFieldDefinition[]>(`/api/admin/custom-fields/${activeModule}`)
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  const openNew = () => {
    setEditId(null)
    setForm({ fieldName: '', label: '', fieldType: 'text', optionsJson: '', isRequired: false, carryOver: false, isEnabled: true })
    setShowForm(true)
  }

  const openEdit = (f: CustomFieldDefinition) => {
    setEditId(f.id)
    setForm({ fieldName: f.fieldName, label: f.label, fieldType: f.fieldType, optionsJson: f.optionsJson || '', isRequired: f.isRequired, carryOver: f.carryOver, isEnabled: f.isEnabled !== false })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.fieldName.trim() || !form.label.trim()) { toast.error('Name and label required'); return }
    if ((form.fieldType === 'select' || form.fieldType === 'multiselect') && !form.optionsJson.trim()) {
      toast.error('Options required for select types'); return
    }
    let options = form.optionsJson.trim()
    if (options && !options.startsWith('[')) {
      options = JSON.stringify(options.split(',').map(s => s.trim()))
    }
    const body = { ...form, fieldName: form.fieldName.trim(), label: form.label.trim(), optionsJson: options || null }
    const r = editId
      ? await api.put(`/api/admin/custom-fields/${activeModule}/${editId}`, body)
      : await api.post(`/api/admin/custom-fields/${activeModule}`, body)
    if (r.ok) { toast.success('Field saved'); setShowForm(false); refetch() }
    else toast.error(r.error || 'Failed to save')
  }

  const handleDelete = async (fieldId: string) => {
    const ok = await confirm({ title: 'Delete field?', description: 'All stored values will be removed.', variant: 'destructive', confirmLabel: 'Delete' })
    if (!ok) return
    const r = await api.del(`/api/admin/custom-fields/${activeModule}/${fieldId}`)
    if (r.ok) { toast.success('Deleted'); refetch() }
    else toast.error('Failed to delete')
  }

  const handleMove = async (fieldId: string, dir: 'up' | 'down') => {
    const idx = fields.findIndex(f => f.id === fieldId)
    if (idx < 0) return
    const sorted = [...fields]
    const swap = dir === 'up' ? idx - 1 : idx + 1
    if (swap < 0 || swap >= sorted.length) return
    ;[sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]]
    const r = await api.put(`/api/admin/custom-fields/${activeModule}/reorder`, { order: sorted.map(f => f.id) })
    if (r.ok) refetch()
  }

  return (
    <div>
      <PageHeader
        title="Module Control"
        description="Define custom fields for each module"
        actions={<Button onClick={openNew}>+ Add Field</Button>}
      />

      <div className="mb-4">
        <ViewToggle
          value={activeModule}
          onChange={setActiveModule}
          options={MODULES.map(m => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) }))}
        />
      </div>

      {isLoading ? (
        <LoadingState rows={4} />
      ) : fields.length === 0 ? (
        <EmptyState title="No custom fields" description={`No fields defined for ${activeModule}.`} action={<Button variant="outline" onClick={openNew}>+ Add Field</Button>} />
      ) : (
        <div className="space-y-2">
          {fields.map((f, i) => (
            <Card key={f.id}>
              <CardContent className="py-3 flex justify-between items-center gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{f.label}</span>
                    <Badge variant="secondary">{f.fieldType}</Badge>
                    {f.isRequired && <Badge variant="outline">Required</Badge>}
                    {f.carryOver && <Badge variant="success">Carry Over</Badge>}
                    {f.isEnabled === false && <Badge variant="outline">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{f.fieldName}{f.optionsJson ? ` · ${f.optionsJson}` : ''}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleMove(f.id, 'up')} disabled={i === 0}>▲</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleMove(f.id, 'down')} disabled={i === fields.length - 1}>▼</Button>
                  <Button variant="outline" size="sm" onClick={async () => {
                    const r = await api.put(`/api/admin/custom-fields/${activeModule}/${f.id}`, { isEnabled: f.isEnabled === false }).catch(() => null)
                    if (r?.ok) { toast.success(f.isEnabled === false ? 'Enabled' : 'Disabled'); refetch() }
                  }}>{f.isEnabled === false ? 'Enable' : 'Disable'}</Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(f)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(f.id)}>Del</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FormDialog open={showForm} title={editId ? 'Edit Field' : 'New Custom Field'} onClose={() => setShowForm(false)} footer={
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      }>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Field Name</Label><Input className="mt-1" value={form.fieldName} onChange={e => setForm(p => ({ ...p, fieldName: e.target.value }))} placeholder="roof_type" disabled={!!editId} /></div>
          <div><Label>Display Label</Label><Input className="mt-1" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="Roof Type" /></div>
          <div>
            <Label>Field Type</Label>
            <Select value={form.fieldType} onChange={e => setForm(p => ({ ...p, fieldType: e.target.value as CustomFieldType }))} className="mt-1">
              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </div>
          {(form.fieldType === 'select' || form.fieldType === 'multiselect') && (
            <div><Label>Options</Label><Input className="mt-1" value={form.optionsJson} onChange={e => setForm(p => ({ ...p, optionsJson: e.target.value }))} placeholder="Option1, Option2" /></div>
          )}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.isRequired} onChange={e => setForm(p => ({ ...p, isRequired: e.target.checked }))} />
            Required
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.carryOver} onChange={e => setForm(p => ({ ...p, carryOver: e.target.checked }))} />
            Carry over when Lead converts
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.isEnabled} onChange={e => setForm(p => ({ ...p, isEnabled: e.target.checked }))} />
            Enabled
          </label>
        </div>
      </FormDialog>
    </div>
  )
}
