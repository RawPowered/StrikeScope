import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../api'
import { PageHeader } from '../../layout/PageHeader'
import FormRenderWidget from './FormRenderWidget'

export default function FormPreview() {
  const { id } = useParams()
  const [form, setForm] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api.get<any>(`/api/admin/forms/${id}`).then(r => {
      if (r.ok) setForm(r.data)
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>
  if (!form) return <div className="text-sm text-red-500">Form not found</div>

  return (
    <div>
      <PageHeader title={`Preview: ${form.name}`} description={form.description} />
      <div className="rounded-lg border border-border bg-surface p-6">
        <FormRenderWidget schemaJson={form.schemaJson} />
      </div>
    </div>
  )
}
