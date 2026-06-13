import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api'
import { PageHeader } from '../layout/PageHeader'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { LoadingState, EmptyState } from '../components/EmptyState'
import { useQuery } from '@tanstack/react-query'
import type { GuideItem } from '@strikescope/shared/src/types'

export default function Guide() {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    label: '', titleEn: '', titleEs: '', descEn: '', descEs: '', requiredCount: 1,
  })

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['guide'],
    queryFn: async () => {
      const r = await api.get<GuideItem[]>('/api/guide')
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  const startEdit = (item: GuideItem) => {
    setEditingId(item.id)
    setEditForm({
      label: item.label,
      titleEn: item.titleEn,
      titleEs: item.titleEs,
      descEn: item.descEn,
      descEs: item.descEs,
      requiredCount: item.requiredCount,
    })
  }

  const handleSave = async (id: string) => {
    const r = await api.put(`/api/guide/${id}`, editForm).catch(() => null)
    if (r?.ok) { toast.success('Saved'); setEditingId(null); refetch() }
    else toast.error('Failed to save')
  }

  const handleAdd = async () => {
    const r = await api.post('/api/guide', {
      label: String(items.length + 1).padStart(2, '0'),
      titleEn: 'New Item',
      titleEs: 'Nuevo Elemento',
      descEn: 'Description',
      descEs: 'Descripción',
      requiredCount: 1,
    }).catch(() => null)
    if (r?.ok) { toast.success('Item added'); refetch() }
    else toast.error('Failed to add item')
  }

  const handleDelete = async (id: string) => {
    const r = await api.del(`/api/guide/${id}`).catch(() => null)
    if (r?.ok) { toast.success('Deleted'); refetch() }
    else toast.error('Failed to delete')
  }

  const moveItem = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= items.length) return
    const copy = [...items]
    ;[copy[index], copy[newIndex]] = [copy[newIndex], copy[index]]
    copy.forEach((item, i) => { item.sortOrder = i })
    const r = await api.put('/api/guide', copy.map(i => ({ id: i.id, sortOrder: i.sortOrder }))).catch(() => null)
    if (r?.ok) refetch()
    else toast.error('Failed to reorder')
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Photo Guide Editor" />
        <LoadingState rows={5} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Photo Guide Editor" description="Installer photo checklist items" actions={<Button onClick={handleAdd}>+ Add Item</Button>} />

      {items.length === 0 ? (
        <EmptyState title="No guide items" description="Add your first photo checklist item." action={<Button onClick={handleAdd}>+ Add Item</Button>} />
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <Card key={item.id}>
              <CardContent className="pt-4">
                {editingId === item.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>Label</Label><Input className="mt-1" value={editForm.label} onChange={e => setEditForm(p => ({ ...p, label: e.target.value }))} /></div>
                      <div><Label>Required Photos</Label><Input type="number" min={1} className="mt-1" value={editForm.requiredCount} onChange={e => setEditForm(p => ({ ...p, requiredCount: parseInt(e.target.value) || 1 }))} /></div>
                      <div><Label>Title EN</Label><Input className="mt-1" value={editForm.titleEn} onChange={e => setEditForm(p => ({ ...p, titleEn: e.target.value }))} /></div>
                      <div><Label>Title ES</Label><Input className="mt-1" value={editForm.titleEs} onChange={e => setEditForm(p => ({ ...p, titleEs: e.target.value }))} /></div>
                    </div>
                    <div><Label>Desc EN</Label><Textarea className="mt-1" value={editForm.descEn} onChange={e => setEditForm(p => ({ ...p, descEn: e.target.value }))} /></div>
                    <div><Label>Desc ES</Label><Textarea className="mt-1" value={editForm.descEs} onChange={e => setEditForm(p => ({ ...p, descEs: e.target.value }))} /></div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSave(item.id)}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-primary min-w-[2rem]">{item.label}</span>
                        <span className="font-medium">{item.titleEn}</span>
                        <Badge variant="secondary">{item.requiredCount} photo{item.requiredCount > 1 ? 's' : ''}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{item.descEn}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => moveItem(i, -1)} disabled={i === 0}>▲</Button>
                      <Button variant="outline" size="sm" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}>▼</Button>
                      <Button variant="outline" size="sm" onClick={() => startEdit(item)}>Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>Del</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
