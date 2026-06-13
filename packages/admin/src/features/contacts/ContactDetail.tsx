import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../api'
import { useAuth } from '../../auth'
import { useConfirm } from '../../components/ConfirmDialog'
import { RecordDetailShell, DetailRow, ActivityTimeline, useRecordDetail } from '../../components/record-detail'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select } from '../../components/ui/select'
import { Textarea } from '../../components/ui/textarea'
import { Badge } from '../../components/ui/badge'
import { PhotoIdCapture } from './PhotoIdCapture'
import type { Contact } from '@strikescope/shared/src/types'

export default function ContactDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { canViewField, canEditField } = useAuth()
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', role: '', contactType: 'standard',
    isPrimary: false, notes: '', ssnLastFour: '', dateOfBirth: '',
  })

  const { record: contact, activities, isLoading, isError, refetch } = useRecordDetail<Contact>(
    id,
    id ? `/api/admin/contacts/${id}` : '',
    'contact',
  )

  const startEdit = () => {
    if (!contact) return
    setForm({
      firstName: contact.firstName,
      lastName: contact.lastName || '',
      email: contact.email || '',
      phone: contact.phone || '',
      role: contact.role || '',
      contactType: contact.contactType || 'standard',
      isPrimary: contact.isPrimary,
      notes: contact.notes || '',
      ssnLastFour: contact.ssnLastFour || '',
      dateOfBirth: contact.dateOfBirth || '',
    })
    setEdit(true)
  }

  const handleSave = async () => {
    if (!id || !form.firstName.trim()) return
    const r = await api.put(`/api/admin/contacts/${id}`, {
      firstName: form.firstName.trim(),
      lastName: form.lastName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      role: form.role || undefined,
      contactType: form.contactType,
      isPrimary: form.isPrimary,
      notes: form.notes || undefined,
      ssnLastFour: form.ssnLastFour || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
    }).catch(() => null)
    if (r?.ok) {
      toast.success('Contact updated')
      setEdit(false)
      refetch()
    } else toast.error(r?.error || 'Failed to save')
  }

  const handleDelete = async () => {
    if (!contact || !id) return
    const ok = await confirm({
      title: 'Delete contact?',
      description: `${contact.firstName} ${contact.lastName || ''}`.trim(),
      variant: 'destructive',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    const r = await api.del(`/api/admin/contacts/${id}`).catch(() => null)
    if (r?.ok) {
      toast.success('Contact deleted')
      navigate('/company/contacts')
    } else toast.error('Failed to delete')
  }

  const displayName = contact ? `${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ''}` : ''

  return (
    <RecordDetailShell
      loading={isLoading}
      notFound={isError || (!isLoading && !contact)}
      backLabel="Back to Contacts"
      onBack={() => navigate('/company/contacts')}
      title={edit ? 'Edit contact' : displayName}
      actions={
        contact && !edit && (
          <div className="flex flex-wrap gap-2">
            {contact.isPrimary && <Badge variant="success">Primary</Badge>}
            <Button variant="outline" size="sm" onClick={startEdit}>Edit</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </div>
        )
      }
    >
      {contact && edit && (
        <Card className="mb-4">
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>First name *</Label><Input className="mt-1" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} /></div>
            <div><Label>Last name</Label><Input className="mt-1" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} /></div>
            <div><Label>Email</Label><Input type="email" className="mt-1" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input className="mt-1" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div><Label>Role</Label><Input className="mt-1" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} /></div>
            <div><Label>Contact type</Label>
              <Select className="mt-1 w-full" value={form.contactType} onChange={e => setForm(p => ({ ...p, contactType: e.target.value }))}>
                <option value="standard">Standard</option>
                <option value="co_signer">Co-Signer</option>
                <option value="primary">Primary</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.isPrimary} onChange={e => setForm(p => ({ ...p, isPrimary: e.target.checked }))} />
              Primary contact
            </label>
            <div className="sm:col-span-2"><Label>Notes</Label><Textarea className="mt-1" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            {canViewField('contacts', 'ssn_last_four') && (
              <div><Label>SSN (last 4)</Label><Input className="mt-1" maxLength={4} disabled={!canEditField('contacts', 'ssn_last_four')} value={form.ssnLastFour} onChange={e => setForm(p => ({ ...p, ssnLastFour: e.target.value }))} /></div>
            )}
            {canViewField('contacts', 'date_of_birth') && (
              <div><Label>Date of birth</Label><Input type="date" className="mt-1" disabled={!canEditField('contacts', 'date_of_birth')} value={form.dateOfBirth} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))} /></div>
            )}
            <div className="sm:col-span-2 flex gap-2">
              <Button onClick={handleSave}>Save</Button>
              <Button variant="outline" onClick={() => setEdit(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {contact && !edit && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
            <CardContent>
              <DetailRow label="Account" value={
                contact.customerName ? (
                  <button type="button" className="text-primary font-medium hover:underline" onClick={() => navigate(`/company/customers/${contact.customerId}`)}>
                    {contact.customerName}
                  </button>
                ) : '—'
              } />
              <DetailRow label="Email" value={contact.email} />
              <DetailRow label="Phone" value={contact.phone} />
              <DetailRow label="Role" value={contact.role} />
              <DetailRow label="Type" value={contact.contactType || 'standard'} />
              <DetailRow label="Created" value={new Date(contact.createdAt).toLocaleString()} />
              <DetailRow label="Notes" value={contact.notes} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Sensitive</CardTitle></CardHeader>
            <CardContent>
              {canViewField('contacts', 'ssn_last_four') && <DetailRow label="SSN (last 4)" value={contact.ssnLastFour} />}
              {canViewField('contacts', 'date_of_birth') && <DetailRow label="Date of birth" value={contact.dateOfBirth} />}
              <PhotoIdCapture contact={contact} onUpdated={refetch} />
            </CardContent>
          </Card>
        </div>
      )}

      {contact && <ActivityTimeline activities={activities} />}
    </RecordDetailShell>
  )
}
