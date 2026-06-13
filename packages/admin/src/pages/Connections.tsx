import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { api } from '../api'
import { PageHeader } from '../layout/PageHeader'
import { DataTable } from '../components/data-table/DataTable'
import { FormDialog } from '../components/ViewToggle'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'
import { useQuery } from '@tanstack/react-query'
import type { Connection, ConnectionType } from '@strikescope/shared/src/types'

const CONN_TYPES: { value: ConnectionType; label: string }[] = [
  { value: 'ssh', label: 'SSH (Remote Host)' },
  { value: 'ftp', label: 'FTP' },
  { value: 'googledrive', label: 'Google Drive' },
  { value: 'dropbox', label: 'Dropbox' },
  { value: 'onedrive', label: 'OneDrive' },
  { value: 'aws-s3', label: 'AWS S3' },
]

const CONN_CONFIG_FIELDS: Record<ConnectionType, { key: string; label: string; secret?: boolean }[]> = {
  ssh: [{ key: 'host', label: 'Hostname' }, { key: 'port', label: 'Port' }, { key: 'username', label: 'Username' }, { key: 'password', label: 'Password', secret: true }],
  ftp: [{ key: 'host', label: 'Hostname' }, { key: 'port', label: 'Port' }, { key: 'username', label: 'Username' }, { key: 'password', label: 'Password', secret: true }],
  googledrive: [{ key: 'clientId', label: 'Client ID', secret: true }, { key: 'clientSecret', label: 'Client Secret', secret: true }, { key: 'folderId', label: 'Folder ID' }],
  dropbox: [{ key: 'accessToken', label: 'Access Token', secret: true }, { key: 'folderPath', label: 'Folder Path' }],
  onedrive: [{ key: 'clientId', label: 'Client ID', secret: true }, { key: 'clientSecret', label: 'Client Secret', secret: true }, { key: 'driveId', label: 'Drive ID' }],
  'aws-s3': [{ key: 'region', label: 'Region' }, { key: 'accessKeyId', label: 'Access Key ID', secret: true }, { key: 'secretAccessKey', label: 'Secret Access Key', secret: true }, { key: 'bucket', label: 'Bucket Name' }],
}

export default function Connections() {
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<ConnectionType>('ftp')
  const [formLabel, setFormLabel] = useState('')
  const [formConfig, setFormConfig] = useState<Record<string, string>>({})
  const [testResult, setTestResult] = useState<string | null>(null)

  const { data: connections = [], isLoading, refetch } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const r = await api.get<Connection[]>('/api/connections')
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  const fields = CONN_CONFIG_FIELDS[formType] || []

  const handleSubmit = async () => {
    if (!formLabel.trim()) { toast.error('Label is required'); return }
    const r = await api.post('/api/connections', { type: formType, label: formLabel, config: formConfig }).catch(() => null)
    if (r?.ok) {
      toast.success('Connection saved')
      setShowForm(false)
      setFormConfig({})
      setFormLabel('')
      refetch()
    } else toast.error('Failed to save connection')
  }

  const handleDelete = async (id: string) => {
    const r = await api.del(`/api/connections/${id}`).catch(() => null)
    if (r?.ok) { toast.success('Deleted'); refetch() }
    else toast.error('Failed to delete')
  }

  const handleTest = async (id: string) => {
    setTestResult('Testing…')
    const r = await api.post<{ success: boolean; message: string }>(`/api/connections/${id}/test`).catch(() => null)
    if (r?.ok && r.data) setTestResult(r.data.success ? `OK: ${r.data.message}` : `FAIL: ${r.data.message}`)
    else setTestResult('Test failed (network error)')
  }

  const columns: ColumnDef<Connection>[] = [
    {
      accessorKey: 'label',
      header: 'Label',
      cell: ({ row }) => <span className="font-medium">{row.original.label}</span>,
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => <Badge variant="secondary">{row.original.type}</Badge>,
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
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => handleTest(row.original.id)}>Test</Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(row.original.id)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Connections"
        description="External storage and remote host integrations"
        actions={<Button onClick={() => setShowForm(true)}>+ Add Connection</Button>}
      />

      <DataTable data={connections} columns={columns} loading={isLoading} emptyMessage="No connections configured." />

      {testResult && (
        <Card className="mt-4">
          <CardContent className="py-3 text-sm">{testResult}</CardContent>
        </Card>
      )}

      <FormDialog open={showForm} title="New Connection" onClose={() => setShowForm(false)} footer={
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Save</Button>
        </div>
      }>
        <div className="space-y-3">
          <div>
            <Label>Type</Label>
            <Select value={formType} onChange={e => { setFormType(e.target.value as ConnectionType); setFormConfig({}) }} className="mt-1">
              {CONN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </div>
          <div>
            <Label>Label</Label>
            <Input value={formLabel} onChange={e => setFormLabel(e.target.value)} placeholder="My Server" className="mt-1" />
          </div>
          {fields.map(f => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Input
                type={f.secret ? 'password' : 'text'}
                value={formConfig[f.key] || ''}
                onChange={e => setFormConfig(p => ({ ...p, [f.key]: e.target.value }))}
                className="mt-1"
              />
            </div>
          ))}
        </div>
      </FormDialog>
    </div>
  )
}
