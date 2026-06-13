import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../api'
import { useConfirm } from '../components/ConfirmDialog'
import { RecordDetailShell, ActivityTimeline, useRecordDetail } from '../components/record-detail'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useQuery } from '@tanstack/react-query'
import type { Lead, LeadStage, Activity } from '@strikescope/shared/src/types'
import { LocationFields } from '../features/territory/LocationFields'
import { MapDirectionsLink, MapEmbed } from '../features/territory/location/MapPreview'

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [edit, setEdit] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', value: '', notes: '', coSignerName: '', coSignerEmail: '', coSignerPhone: '', projectTypeId: '', address: '', city: '', state: '', county: '', zip: '' })
  const [converting, setConverting] = useState(false)
  const [dncReason, setDncReason] = useState('')
  const [showDncForm, setShowDncForm] = useState(false)

  const { record: lead, activities, isLoading, isError, refetch } = useRecordDetail<Lead>(
    id,
    id ? `/api/admin/leads/${id}` : '',
    'lead',
  )

  const { data: stages = [] } = useQuery<LeadStage[]>({
    queryKey: ['lead-stages'],
    queryFn: async () => {
      const r = await api.get<LeadStage[]>('/api/admin/lead-stages?perPage=50')
      return r.ok && r.data ? (Array.isArray(r.data) ? r.data : (r.data as any).data || []) : []
    },
    enabled: !!id,
  })

  const { data: projectTypes = [] } = useQuery({
    queryKey: ['project-types'],
    queryFn: async () => {
      const r = await api.get<any[]>('/api/admin/project-types')
      return r.ok && r.data ? r.data : []
    },
    enabled: !!id,
  })

  const handleStageChange = async (stageId: string) => {
    if (!id) return
    const r = await api.put(`/api/admin/leads/${id}`, { stageId }).catch(() => null)
    if (r?.ok) { toast.success('Stage updated'); refetch() }
    else toast.error('Failed to update stage')
  }

  const startEdit = () => {
    if (!lead) return
    setEditForm({
      name: lead.name, email: lead.email || '', phone: lead.phone || '',
      value: lead.value?.toString() || '', notes: lead.notes || '',
      coSignerName: lead.coSignerName || '', coSignerEmail: lead.coSignerEmail || '',
      coSignerPhone: lead.coSignerPhone || '', projectTypeId: lead.projectTypeId || '',
      address: lead.address || '', city: lead.city || '', state: lead.state || '',
      county: lead.county || '', zip: lead.zip || '',
    })
    setEdit(true)
  }

  const handleSave = async () => {
    if (!id || !editForm.name.trim()) return
    const r = await api.put(`/api/admin/leads/${id}`, {
      name: editForm.name.trim(), email: editForm.email || undefined,
      phone: editForm.phone || undefined, notes: editForm.notes || undefined,
      value: editForm.value ? parseFloat(editForm.value) : undefined,
      projectTypeId: editForm.projectTypeId || undefined,
      coSignerName: editForm.coSignerName || undefined,
      coSignerEmail: editForm.coSignerEmail || undefined,
      coSignerPhone: editForm.coSignerPhone || undefined,
      address: editForm.address || undefined, city: editForm.city || undefined,
      state: editForm.state || undefined, county: editForm.county || undefined, zip: editForm.zip || undefined,
    }).catch(() => null)
    if (r?.ok) { toast.success('Lead saved'); setEdit(false); refetch() }
    else toast.error(r?.error || 'Failed to update')
  }

  const handleDnc = async () => {
    if (!id || !dncReason.trim()) return
    const r = await api.post(`/api/admin/leads/${id}/dnc`, { reason: dncReason.trim() }).catch(() => null)
    if (r?.ok) { toast.success('Marked Do Not Contact'); setShowDncForm(false); setDncReason(''); refetch() }
    else toast.error(r?.error || 'Failed to mark DNC')
  }

  const handleRemoveDnc = async () => {
    if (!id) return
    const ok = await confirm({ title: 'Remove DNC?', description: 'This lead can be contacted again.' })
    if (!ok) return
    const r = await api.del(`/api/admin/leads/${id}/dnc`).catch(() => null)
    if (r?.ok) { toast.success('DNC removed'); refetch() }
    else toast.error('Failed to remove DNC')
  }

  const handleConvert = async () => {
    if (!id) return
    const ok = await confirm({
      title: 'Convert to account?',
      description: 'Creates a customer, contacts, and optional project from this lead.',
      confirmLabel: 'Convert',
    })
    if (!ok) return
    setConverting(true)
    const r = await api.post(`/api/admin/leads/${id}/convert`, {}).catch(() => null)
    setConverting(false)
    if (r?.ok) { toast.success('Lead converted'); refetch() }
    else toast.error(r?.error || 'Conversion failed')
  }

  const isConverted = !!lead?.convertedAccountId
  const wonStage = stages.find(s => s.name.toLowerCase() === 'won')
  const currentStage = stages.find(s => s.id === lead?.stageId)

  return (
    <RecordDetailShell
      loading={isLoading}
      notFound={isError || (!isLoading && !lead)}
      backLabel="Back to Pipeline"
      onBack={() => navigate('/company/leads')}
      title={edit ? '' : lead?.name}
      actions={
        lead && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={lead.stageId || ''} onChange={e => handleStageChange(e.target.value)} className="w-auto min-w-[140px] font-medium">
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            {lead.dncAt && <Badge variant="destructive">DNC</Badge>}
            {isConverted && <Badge variant="success">Converted</Badge>}
            {!isConverted && !lead.dncAt && (
              <Button variant="outline" size="sm" onClick={() => setShowDncForm(true)}>Mark DNC</Button>
            )}
            {lead.dncAt && (
              <Button variant="outline" size="sm" onClick={handleRemoveDnc}>Remove DNC</Button>
            )}
            {!isConverted && wonStage && lead.stageId === wonStage.id && (
              <Button size="sm" onClick={handleConvert} disabled={converting}>
                {converting ? 'Converting\u2026' : 'Convert to Account'}
              </Button>
            )}
            {!edit && !isConverted && (
              <Button variant="outline" size="sm" onClick={startEdit}>Edit</Button>
            )}
          </div>
        )
      }
    >
      {edit && (
        <Card className="mb-4">
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Email</Label><Input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div><Label>Value</Label><Input value={editForm.value} onChange={e => setEditForm(p => ({ ...p, value: e.target.value }))} /></div>
            <div><Label>Project Type</Label>
              <Select value={editForm.projectTypeId} onChange={e => setEditForm(p => ({ ...p, projectTypeId: e.target.value }))}>
                <option value="">\u2014</option>
                {projectTypes.map((pt: any) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Notes</Label><Textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <div className="sm:col-span-2"><LocationFields value={editForm} onChange={v => setEditForm(p => ({ ...p, ...v }))} /></div>
            <div className="sm:col-span-2 flex gap-2">
              <Button onClick={handleSave}>Save</Button>
              <Button variant="outline" onClick={() => setEdit(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {lead && currentStage && (
        <p className="text-sm text-muted-foreground -mt-4 mb-4">
          Stage: <Badge variant="secondary" style={{ backgroundColor: currentStage.color, color: '#fff' }}>{currentStage.name}</Badge>
        </p>
      )}

      {isConverted && (
        <Card className="mb-4 border-green-200 bg-green-50">
          <CardContent className="py-3 text-sm">
            Converted to account
            {lead?.convertedAccountId && (
              <> \u00B7 <button type="button" className="text-primary font-medium hover:underline" onClick={() => navigate(`/company/customers/${lead.convertedAccountId}`)}>View customer</button></>
            )}
            {lead?.convertedProjectId && (
              <> \u00B7 <button type="button" className="text-primary font-medium hover:underline" onClick={() => navigate(`/company/projects/${lead.convertedProjectId}`)}>View project</button></>
            )}
          </CardContent>
        </Card>
      )}

      {showDncForm && (
        <Card className="mb-4 border-red-200">
          <CardHeader className="pb-2"><CardTitle className="text-base text-red-700">Mark Do Not Contact</CardTitle></CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1"><Label>Reason</Label><Input value={dncReason} onChange={e => setDncReason(e.target.value)} placeholder="Why should this lead not be contacted?" /></div>
            <div className="flex items-end gap-2">
              <Button variant="destructive" onClick={handleDnc} disabled={!dncReason.trim()}>Confirm</Button>
              <Button variant="outline" onClick={() => setShowDncForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div><span className="text-muted-foreground">Email:</span> {lead?.email || '\u2014'}</div>
            <div><span className="text-muted-foreground">Phone:</span> {lead?.phone || '\u2014'}</div>
            <div><span className="text-muted-foreground">Project type:</span> {lead?.projectTypeName || '\u2014'}</div>
            <div><span className="text-muted-foreground">Value:</span> {lead?.value != null ? `$${lead.value.toLocaleString()}` : '\u2014'}</div>
            <div><span className="text-muted-foreground">Created:</span> {lead?.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '\u2014'}</div>
            {lead?.notes && <div><span className="text-muted-foreground">Notes:</span> {lead.notes}</div>}
            {lead?.dncAt && (
              <div className="text-red-600 pt-2 border-t border-border">
                DNC since {new Date(lead.dncAt).toLocaleDateString()}
                {lead.dncReason && <> \u00B7 {lead.dncReason}</>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Co-Signer</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div><span className="text-muted-foreground">Name:</span> {lead?.coSignerName || '\u2014'}</div>
            <div><span className="text-muted-foreground">Email:</span> {lead?.coSignerEmail || '\u2014'}</div>
            <div><span className="text-muted-foreground">Phone:</span> {lead?.coSignerPhone || '\u2014'}</div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Location</CardTitle>
            <MapDirectionsLink address={{ address: lead?.address, city: lead?.city, state: lead?.state, zip: lead?.zip }} />
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>{[lead?.address, lead?.city, lead?.state, lead?.zip].filter(Boolean).join(', ') || '\u2014'}</div>
            {lead?.county && <div><span className="text-muted-foreground">County:</span> {lead.county}</div>}
            <MapEmbed address={{ address: lead?.address, city: lead?.city, state: lead?.state, zip: lead?.zip }} />
          </CardContent>
        </Card>
      </div>

      <ActivityTimeline activities={activities} />
    </RecordDetailShell>
  )
}
