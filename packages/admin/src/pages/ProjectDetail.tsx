import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { LocationFields } from '../features/territory/LocationFields'
import { MapDirectionsLink, MapEmbed } from '../features/territory/location/MapPreview'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ProjectProgressCard } from '../features/projects/ProjectProgressCard'
import ProjectFinanceTab from '../features/finance/ProjectFinanceTab'
import type { ProjectProgress } from '@strikescope/shared/src/types'
import { api } from '../api'
import { RecordDetailShell, DetailRow, useRecordDetail } from '../components/record-detail'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import type { Activity } from '@strikescope/shared/src/types'
import { FinancingFields } from '../features/financing/FinancingFields'
import { financingTypeLabel } from '../lib/financing'
import { projectTypeFlags } from '../lib/project-type-flags'

interface ProjectItem {
  id: string; projectId: string; templateItemId: string; label: string; sortOrder: number
  titleEn: string; titleEs: string; descEn: string; descEs: string
  requiredCount: number; exampleImage: string | null
}

interface ProjectDetail {
  id: string; companyId: string; customerId: string; projectTypeId: string
  name: string; address: string; city?: string; state?: string; county?: string; zip?: string
  countyDepartment?: string; permitNumber?: string; propertyLegalDescription?: string
  coSignerContactId?: string
  status: string; assignedTo: string; notes: string
  isActive: number; createdAt: string; customerName: string; projectTypeName: string
  projectTypeCategory?: string; projectTypeIsConstruction?: boolean
  projectTypeIncludeCountyDefaults?: boolean; projectTypeRequiresPermit?: boolean
  projectTypeIncludeFinancingFields?: boolean
  financingType?: string; bankId?: string; bankName?: string
  progress?: ProjectProgress
  stale?: { isStale: boolean; kind?: string; detail?: string; since?: string | null }
  sprintStartedAt?: string | null
  sprintCompletedAt?: string | null
  lastFieldActivityAt?: string | null
  scheduledInstallAt?: string | null
  worksiteLat?: number | null
  worksiteLng?: number | null
  geofenceRadiusM?: number | null
  assignments?: { userId: string; role: string }[]
  items: ProjectItem[]
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  planned: 'secondary',
  active: 'default',
  completed: 'success',
  cancelled: 'destructive',
}

export default function ProjectDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const salesView = searchParams.get('view') === 'sales' || user?.roleName === 'Sales Agent'
  const showFinance = user?.roleName === 'Sales Manager' || user?.role === 'server_admin' || user?.role === 'company_admin'
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    address: '', city: '', state: '', county: '', zip: '',
    countyDepartment: '', permitNumber: '', propertyLegalDescription: '',
    financingType: '', bankId: '',
    scheduledInstallAt: '', worksiteLat: '', worksiteLng: '', geofenceRadiusM: '',
  })

  const { record: project, activities, isLoading, isError, refetch } = useRecordDetail<ProjectDetail>(
    id,
    id ? `/api/admin/projects/${id}` : '',
    'project',
  )

  const initEdit = (p: ProjectDetail) => {
    setEditForm({
      address: p.address || '', city: p.city || '', state: p.state || '',
      county: p.county || '', zip: p.zip || '',
      countyDepartment: p.countyDepartment || '', permitNumber: p.permitNumber || '',
      propertyLegalDescription: p.propertyLegalDescription || '',
      financingType: p.financingType || '', bankId: p.bankId || '',
      scheduledInstallAt: p.scheduledInstallAt?.slice(0, 16) || '',
      worksiteLat: p.worksiteLat != null ? String(p.worksiteLat) : '',
      worksiteLng: p.worksiteLng != null ? String(p.worksiteLng) : '',
      geofenceRadiusM: p.geofenceRadiusM != null ? String(p.geofenceRadiusM) : '',
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!id) return
    const payload = {
      ...editForm,
      scheduledInstallAt: editForm.scheduledInstallAt || null,
      worksiteLat: editForm.worksiteLat ? parseFloat(editForm.worksiteLat) : null,
      worksiteLng: editForm.worksiteLng ? parseFloat(editForm.worksiteLng) : null,
      geofenceRadiusM: editForm.geofenceRadiusM ? parseInt(editForm.geofenceRadiusM, 10) : null,
    }
    const r = await api.put(`/api/admin/projects/${id}`, payload).catch(() => null)
    if (r?.ok) { toast.success('Project updated'); setEditing(false); refetch() }
    else toast.error(r?.error || 'Failed to update')
  }

  if (!project) {
    return (
      <RecordDetailShell
        loading={isLoading}
        notFound={isError || (!isLoading && !project)}
        backLabel="Back to Projects"
        onBack={() => window.history.back()}
      />
    )
  }

  const financingFlags = projectTypeFlags({
    isConstruction: !!project.projectTypeIsConstruction,
    includeFinancingFields: !!project.projectTypeIncludeFinancingFields,
  } as any)

  return (
    <RecordDetailShell
      loading={isLoading}
      notFound={false}
      backLabel="Back to Projects"
      onBack={() => window.history.back()}
      title={project.name}
      description={`${project.customerName} \u00B7 ${project.projectTypeName}`}
      actions={<Badge variant={STATUS_VARIANT[project.status] || 'secondary'}>{project.status}</Badge>}
    >
      {project.stale?.isStale && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Stale project</strong> \u2014 {project.stale.detail}
        </div>
      )}
      {project.progress && <div className="mb-4"><ProjectProgressCard progress={project.progress} /></div>}

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          {!salesView && <TabsTrigger value="items">Items ({project.items.length})</TabsTrigger>}
          {showFinance && !salesView && <TabsTrigger value="finance">Finance</TabsTrigger>}
          {!salesView && <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-end mb-2">
                <Button size="sm" variant="outline" onClick={() => editing ? setEditing(false) : initEdit(project)}>{editing ? 'Cancel' : 'Edit Site / Permit'}</Button>
              </div>
              {editing ? (
                <div className="space-y-3">
                  <LocationFields value={editForm} onChange={v => setEditForm(f => ({ ...f, ...v }))} />
                  {project.projectTypeIncludeCountyDefaults && (
                    <div><span className="text-sm text-muted-foreground">County Department</span>
                      <Input className="mt-1" value={editForm.countyDepartment} onChange={e => setEditForm(f => ({ ...f, countyDepartment: e.target.value }))} /></div>
                  )}
                  {project.projectTypeRequiresPermit ? (
                    <>
                      <div><span className="text-sm text-muted-foreground">Permit Number *</span>
                        <Input className="mt-1" value={editForm.permitNumber} onChange={e => setEditForm(f => ({ ...f, permitNumber: e.target.value }))} /></div>
                      <div><span className="text-sm text-muted-foreground">Property Legal Description *</span>
                        <Textarea className="mt-1" value={editForm.propertyLegalDescription} onChange={e => setEditForm(f => ({ ...f, propertyLegalDescription: e.target.value }))} /></div>
                    </>
                  ) : project.projectTypeIsConstruction ? (
                    <p className="text-xs text-muted-foreground">Construction project \u2014 new permit typically not required for this type.</p>
                  ) : null}
                  {financingFlags.showFinancingFields && (
                    <FinancingFields
                      value={{ financingType: editForm.financingType, bankId: editForm.bankId }}
                      onChange={v => setEditForm(f => ({ ...f, ...v }))}
                    />
                  )}
                  <div className="border-t border-border pt-3 space-y-3">
                    <p className="text-sm font-medium">Field / geofence</p>
                    <div>
                      <span className="text-sm text-muted-foreground">Scheduled install</span>
                      <Input type="datetime-local" className="mt-1" value={editForm.scheduledInstallAt} onChange={e => setEditForm(f => ({ ...f, scheduledInstallAt: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-sm text-muted-foreground">Worksite latitude</span>
                        <Input type="number" step="any" className="mt-1" placeholder="e.g. 33.4484" value={editForm.worksiteLat} onChange={e => setEditForm(f => ({ ...f, worksiteLat: e.target.value }))} />
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Worksite longitude</span>
                        <Input type="number" step="any" className="mt-1" placeholder="-112.0740" value={editForm.worksiteLng} onChange={e => setEditForm(f => ({ ...f, worksiteLng: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Geofence radius (meters)</span>
                      <Input type="number" min={50} className="mt-1" placeholder="150" value={editForm.geofenceRadiusM} onChange={e => setEditForm(f => ({ ...f, geofenceRadiusM: e.target.value }))} />
                    </div>
                  </div>
                  <Button onClick={saveEdit}>Save</Button>
                </div>
              ) : (
                <>
                  <DetailRow label="Name" value={project.name} />
                  <DetailRow label="Address" value={project.address} />
                  <DetailRow label="City" value={project.city} />
                  <DetailRow label="State" value={project.state} />
                  <DetailRow label="County" value={project.county} />
                  <DetailRow label="ZIP" value={project.zip} />
                  <div className="py-2 flex items-center gap-3">
                    <MapDirectionsLink address={{ address: project.address, city: project.city, state: project.state, zip: project.zip }} />
                  </div>
                  <MapEmbed address={{ address: project.address, city: project.city, state: project.state, zip: project.zip }} />
                  <DetailRow label="County Department" value={project.countyDepartment} />
                  <DetailRow label="Permit Number" value={project.permitNumber} />
                  <DetailRow label="Legal Description" value={project.propertyLegalDescription} />
                  {financingFlags.showFinancingFields && (
                    <>
                      <DetailRow label="Financing Type" value={financingTypeLabel(project.financingType)} />
                      <DetailRow label="Bank" value={project.bankName} />
                    </>
                  )}
                  <DetailRow label="Customer" value={project.customerName} />
                  <DetailRow label="Type" value={project.projectTypeName} />
                  <DetailRow label="Status" value={project.status} />
                  <DetailRow label="Assigned To" value={project.assignedTo} />
                  <DetailRow label="Notes" value={project.notes} />
                  <DetailRow label="Scheduled install" value={project.scheduledInstallAt ? new Date(project.scheduledInstallAt).toLocaleString() : null} />
                  <DetailRow label="Worksite coords" value={
                    project.worksiteLat != null && project.worksiteLng != null
                      ? `${project.worksiteLat}, ${project.worksiteLng}`
                      : null
                  } />
                  <DetailRow label="Geofence (m)" value={project.geofenceRadiusM ?? 'Template default'} />
                  <DetailRow label="Sprint started" value={project.sprintStartedAt ? new Date(project.sprintStartedAt).toLocaleString() : null} />
                  <DetailRow label="Last field activity" value={project.lastFieldActivityAt ? new Date(project.lastFieldActivityAt).toLocaleString() : null} />
                  <DetailRow label="Created" value={new Date(project.createdAt).toLocaleString()} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {showFinance && !salesView && (
          <TabsContent value="finance">
            {id && <ProjectFinanceTab projectId={id} />}
          </TabsContent>
        )}

        <TabsContent value="items">
          {project.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No items in this project.</p>
          ) : (
            <div className="space-y-3">
              {project.items.map(item => (
                <Card key={item.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{item.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p>{item.titleEn}{item.titleEs ? ` / ${item.titleEs}` : ''}</p>
                    {(item.descEn || item.descEs) && (
                      <p className="text-muted-foreground text-xs">{item.descEn}{item.descEs ? ` / ${item.descEs}` : ''}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Required photos: {item.requiredCount}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity">
          {activities.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity recorded for this project yet.</p>
          ) : (
            <div className="space-y-2">
              {activities.map(a => (
                <Card key={a.id}>
                  <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
                    <span>
                      <strong>{a.action}</strong>
                      {a.description ? ` \u2014 ${a.description}` : ''}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {a.performedBy} \u00B7 {a.performedAt ? new Date(a.performedAt).toLocaleString() : '\u2014'}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </RecordDetailShell>
  )
}
