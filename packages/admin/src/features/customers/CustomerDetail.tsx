import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { useAuth } from '../../auth'
import { RecordDetailShell, useRecordDetail } from '../../components/record-detail'
import CustomerFiles from './CustomerFiles'
import { Button } from '../../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Badge } from '../../components/ui/badge'
import { Card, CardContent } from '../../components/ui/card'
import type { Customer, Contact, Activity, Project } from '@strikescope/shared/src/types'
import CustomerProperties from '../properties/CustomerProperties'

type Tab = 'info' | 'contacts' | 'properties' | 'files' | 'projects' | 'activity'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { can } = useAuth()

  const tabParam = searchParams.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(tabParam && ['info', 'contacts', 'properties', 'files', 'projects', 'activity'].includes(tabParam) ? tabParam : 'info')

  const setTabAndUrl = (t: Tab) => {
    setTab(t)
    setSearchParams(t === 'info' ? {} : { tab: t }, { replace: true })
  }

  const { record: customer, activities, isLoading, isError } = useRecordDetail<Customer>(
    id,
    id ? `/api/admin/customers/${id}` : '',
    'customer',
  )

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['customer-contacts', id],
    queryFn: async () => {
      if (!id) return []
      const r = await api.get<Contact[]>(`/api/admin/contacts?customerId=${id}`)
      return r.ok && r.data ? r.data : []
    },
    enabled: !!id,
  })

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['customer-projects', id],
    queryFn: async () => {
      if (!id) return []
      const r = await api.get<Project[]>(`/api/admin/projects?customerId=${id}`)
      return r.ok && r.data ? r.data : []
    },
    enabled: !!id,
  })

  return (
    <RecordDetailShell
      loading={isLoading}
      notFound={isError || (!isLoading && !customer)}
      backLabel="Back to Customers"
      onBack={() => navigate('/company/customers')}
      title={customer?.name}
      description={customer?.email || undefined}
    >
      {customer && id && (
        <>
          <Tabs value={tab} onValueChange={v => setTabAndUrl(v as Tab)}>
            <TabsList>
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
              <TabsTrigger value="properties">Properties</TabsTrigger>
              {(can('customers') || can('agreements')) && <TabsTrigger value="files">Files</TabsTrigger>}
              <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><strong>Phone:</strong> {customer.phone || '\u2014'}</div>
                    <div><strong>Email:</strong> {customer.email || '\u2014'}</div>
                    <div><strong>Address:</strong> {customer.address || '\u2014'}</div>
                    <div><strong>City:</strong> {customer.city || '\u2014'}</div>
                    <div><strong>State:</strong> {customer.state || '\u2014'}</div>
                    <div><strong>County:</strong> {customer.county || '\u2014'}</div>
                    <div><strong>ZIP:</strong> {customer.zip || '\u2014'}</div>
                    <div><strong>Notes:</strong> {customer.notes || '\u2014'}</div>
                    <div><strong>Source:</strong> {customer.source || '\u2014'}</div>
                    <div><strong>Type:</strong> {customer.type || '\u2014'}</div>
                    <div><strong>Created:</strong> {new Date(customer.createdAt).toLocaleDateString()}</div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contacts">
              <div className="space-y-2">
                {contacts.map(c => (
                  <Card key={c.id}>
                    <CardContent className="py-3">
                      <strong>{c.firstName}{c.lastName ? ` ${c.lastName}` : ''}</strong>
                      {c.isPrimary && <Badge variant="success" className="ml-2">Primary</Badge>}
                      {c.contactType === 'co_signer' && <Badge variant="secondary" className="ml-2">Co-Signer</Badge>}
                      {c.hasPhotoId && <Badge variant="outline" className="ml-2">Photo ID</Badge>}
                      <div className="text-xs text-muted-foreground mt-1">
                        {c.email} {c.phone && `\u00B7 ${c.phone}`} {c.role && `\u00B7 ${c.role}`}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {contacts.length === 0 && <p className="text-muted-foreground text-sm">No contacts for this account.</p>}
              </div>
            </TabsContent>

            <TabsContent value="properties">
              <CustomerProperties customerId={id} contacts={contacts} />
            </TabsContent>

            <TabsContent value="files">
              <CustomerFiles customerId={id} />
            </TabsContent>

            <TabsContent value="projects">
              <div className="space-y-2">
                {projects.map(p => (
                  <Card key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/company/projects/${p.id}`)}>
                    <CardContent className="py-3 flex justify-between items-center">
                      <div>
                        <strong>{p.name}</strong>
                        <Badge variant="secondary" className="ml-2">{p.status}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </CardContent>
                  </Card>
                ))}
                {projects.length === 0 && <p className="text-muted-foreground text-sm">No projects for this account.</p>}
              </div>
            </TabsContent>

            <TabsContent value="activity">
              <div className="space-y-2">
                {activities.map(a => (
                  <Card key={a.id}>
                    <CardContent className="py-3 flex justify-between text-sm">
                      <div>
                        <strong>{a.userName || 'System'}</strong>
                        <span className="text-muted-foreground ml-2">{a.action}</span>
                        {a.description && <div className="text-muted-foreground mt-1">{a.description}</div>}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</span>
                    </CardContent>
                  </Card>
                ))}
                {activities.length === 0 && <p className="text-muted-foreground text-sm">No activity recorded.</p>}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </RecordDetailShell>
  )
}
