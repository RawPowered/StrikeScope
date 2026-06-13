import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../api'
import { PageHeader } from '../../layout/PageHeader'
import { Button } from '../../components/ui/button'
import FormBuilderWidget from './FormBuilderWidget'

export default function FormEditor() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [schemaJson, setSchemaJson] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (!id) return
    api.get<any>(`/api/admin/forms/${id}`).then(r => {
      if (r.ok && r.data) {
        setName(r.data.name)
        setDescription(r.data.description || '')
        setSchemaJson(r.data.schemaJson)
      }
      setLoading(false)
    })
  }, [id])

  const handleSave = async (json: string) => {
    if (!name.trim()) {
      toast.error('Form name is required')
      return
    }
    setSaving(true)
    setSchemaJson(json)
    try {
      if (isEdit) {
        const r = await api.put(`/api/admin/forms/${id}`, { name, description, schemaJson: json })
        if (r.ok) { toast.success('Form updated'); navigate('/company/forms') }
        else toast.error(r.error || 'Failed to update')
      } else {
        const r = await api.post('/api/admin/forms', { name, description, schemaJson: json })
        if (r.ok) { toast.success('Form created'); navigate('/company/forms') }
        else toast.error(r.error || 'Failed to create')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Form' : 'New Form'}
        actions={
          <Button variant="outline" onClick={() => navigate('/company/forms')}>Cancel</Button>
        }
      />
      <div className="mb-4 space-y-3 rounded-lg border border-border bg-surface p-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Form Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="e.g. Contact Us"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Brief description of this form"
          />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface">
        <FormBuilderWidget initialData={schemaJson} onSave={handleSave} />
      </div>
    </div>
  )
}
