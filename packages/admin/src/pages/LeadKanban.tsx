import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '../api'
import ColumnPicker from '../components/ColumnPicker'
import { useQuery } from '@tanstack/react-query'
import type { Lead, LeadStage } from '@strikescope/shared/src/types'
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, useDraggable, useDroppable } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { PageHeader } from '../layout/PageHeader'
import { ViewToggle } from '../components/ViewToggle'
import { DataTable } from '../components/data-table/DataTable'
import { LoadingState, EmptyState } from '../components/EmptyState'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { cn } from '../lib/utils'
import { TerritoryTabsBar } from '../features/territory/TerritoryTabs'
import { CityFilter } from '../features/territory/CityFilter'
import { useTerritoryFilters } from '../features/territory/useTerritoryFilters'
import { LocationFields } from '../features/territory/LocationFields'
import { asList } from '../lib/list-response'
import { US_STATES } from '../lib/us-states'

const BUILT_IN = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'projectTypeName', label: 'Project Type' },
  { key: 'stage', label: 'Status' },
  { key: 'notes', label: 'Notes' },
  { key: 'value', label: 'Value' },
]

function LeadCard({ lead, compact, onOpen }: { lead: Lead; compact?: boolean; onOpen?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id, data: lead })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined
  const daysInStage = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86400000)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'mb-2 flex rounded-lg border border-border bg-surface shadow-sm text-xs transition-shadow hover:shadow-md',
        isDragging && 'opacity-50 ring-2 ring-primary/30',
      )}
      style={style}
    >
      <button
        type="button"
        aria-label="Drag lead"
        className="cursor-grab active:cursor-grabbing shrink-0 px-1.5 py-3 text-muted-foreground hover:text-foreground"
        {...listeners}
        {...attributes}
      >
        ⋮⋮
      </button>
      <button
        type="button"
        className="flex-1 min-w-0 p-3 pr-2 text-left"
        onClick={() => onOpen?.(lead.id)}
      >
        <div className="font-semibold mb-1">{lead.name}</div>
        {!compact && lead.email && <div className="text-muted-foreground truncate">{lead.email}</div>}
        {!compact && lead.projectTypeName && <div className="text-muted-foreground text-[10px]">{lead.projectTypeName}</div>}
        {lead.value != null && <div className="text-primary font-semibold mt-1">${lead.value.toLocaleString()}</div>}
        <div className="text-[10px] text-muted-foreground mt-1">{daysInStage}d in stage</div>
      </button>
    </div>
  )
}

function KanbanColumn({ stage, leads, onOpenLead }: { stage: LeadStage; leads: Lead[]; onOpenLead: (id: string) => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id, data: stage })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-w-[240px] flex-1 flex flex-col rounded-lg p-2 transition-colors',
        isOver ? 'bg-primary/5 ring-1 ring-primary/20' : 'bg-muted/60',
      )}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: stage.color }} />
        <span className="text-sm font-semibold">{stage.name}</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{leads.length}</span>
      </div>
      <div className="flex-1 min-h-[80px] space-y-0">
        {leads.map(lead => <LeadCard key={lead.id} lead={lead} onOpen={onOpenLead} />)}
        {leads.length === 0 && (
          <p className="text-center text-[11px] text-muted-foreground py-8">Drop leads here</p>
        )}
      </div>
    </div>
  )
}

export default function LeadKanban() {
  const navigate = useNavigate()
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [showNew, setShowNew] = useState(false)
  const { queryString, state: territoryState, setState: clearTerritoryState, territoryActive } = useTerritoryFilters()
  const [newForm, setNewForm] = useState({ name: '', email: '', phone: '', value: '', projectTypeId: '', notes: '', address: '', city: '', state: '', county: '', zip: '' })
  const [columns, setColumns] = useState<string[]>(['name', 'email', 'phone', 'value', 'stage'])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const { data: leadsData, isLoading, refetch } = useQuery({
    queryKey: ['leads', queryString],
    queryFn: async () => {
      const res = await api.get(`/api/admin/leads?perPage=100&include_custom_fields=true${queryString}`)
      if (!res.ok) throw new Error(res.error || 'Failed to load leads')
      return asList<Lead>(res)
    },
  })

  const { data: stagesData } = useQuery({
    queryKey: ['lead-stages'],
    queryFn: async () => {
      const res = await api.get('/api/admin/lead-stages?perPage=50')
      if (!res.ok) throw new Error(res.error || 'Failed to load stages')
      return asList<LeadStage>(res).map(s => ({ ...s, isDefault: !!(s as LeadStage & { isDefault?: boolean | number }).isDefault }))
    },
  })

  const { data: projectTypes = [] } = useQuery({
    queryKey: ['project-types'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/admin/project-types')
      if (!res.ok) throw new Error(res.error || 'Failed to load project types')
      return res.data
    },
  })

  const leads = leadsData ?? []
  const stages = stagesData ?? []

  const handleColumnsSave = async (cols: string[]) => {
    setColumns(cols)
    await api.put('/api/admin/column-preferences/leads', { columns: cols })
  }

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveLead(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const lead = leads.find(l => l.id === active.id)
    if (!lead || lead.stageId === over.id) return
    const r = await api.put(`/api/admin/leads/${lead.id}`, { stageId: over.id as string }).catch(() => null)
    if (r?.ok) {
      toast.success('Lead moved')
      refetch()
    } else {
      toast.error('Failed to move lead')
    }
  }, [leads, refetch])

  const handleCreate = async () => {
    if (!newForm.name.trim()) return
    const parsedValue = newForm.value.trim() ? Number(newForm.value.replace(/[^0-9.-]/g, '')) : undefined
    const r = await api.post('/api/admin/leads', {
      name: newForm.name.trim(),
      email: newForm.email.trim() || null,
      phone: newForm.phone.trim() || null,
      value: parsedValue != null && !Number.isNaN(parsedValue) ? parsedValue : null,
      projectTypeId: newForm.projectTypeId || null,
      notes: newForm.notes.trim() || null,
      address: newForm.address?.trim() || null,
      city: newForm.city?.trim() || null,
      state: newForm.state?.trim() || null,
      county: newForm.county?.trim() || null,
      zip: newForm.zip?.trim() || null,
    }).catch(() => null)
    if (r?.ok) {
      toast.success('Lead created')
      setShowNew(false)
      setNewForm({ name: '', email: '', phone: '', value: '', projectTypeId: '', notes: '', address: '', city: '', state: '', county: '', zip: '' })
      refetch()
    } else {
      toast.error(r?.error || 'Failed to create lead — check workspace is selected')
    }
  }

  const stageMap = Object.fromEntries(stages.map(s => [s.id, s]))
  const leadsByStage: Record<string, Lead[]> = {}
  const unassigned: Lead[] = []
  stages.forEach(s => { leadsByStage[s.id] = [] })
  const defaultStageId = stages.find(s => s.isDefault)?.id || stages[0]?.id
  leads.forEach(l => {
    const sid = l.stageId || defaultStageId
    if (sid && leadsByStage[sid]) leadsByStage[sid].push(l)
    else unassigned.push(l)
  })

  const tableColumns: ColumnDef<any>[] = [
    ...columns.map(key => ({
      accessorKey: key,
      header: BUILT_IN.find(b => b.key === key)?.label || key,
      cell: ({ row }: { row: { original: any } }) => {
        const lead = row.original
        const stage = stageMap[lead.stageId]
        if (key === 'name') return <span className="font-medium">{lead.name}</span>
        if (key === 'stage') return stage ? <Badge variant="secondary" style={{ backgroundColor: stage.color, color: '#fff' }}>{stage.name}</Badge> : '—'
        if (key === 'value') return lead.value != null ? `$${lead.value.toLocaleString()}` : '—'
        if (key.startsWith('cf_')) {
          const cf = lead.customFieldsJson ? JSON.parse(lead.customFieldsJson) : {}
          return cf[key.slice(3)] || '—'
        }
        return lead[key] || '—'
      },
    })),
  ]

  if (isLoading) return <LoadingState rows={6} />

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description={`${leads.length} active lead${leads.length === 1 ? '' : 's'}`}
        actions={
          <>
            <ViewToggle value={view} onChange={setView} options={[{ value: 'kanban', label: 'Kanban' }, { value: 'table', label: 'Table' }]} />
            <ColumnPicker entity="leads" builtInFields={BUILT_IN} selectedColumns={columns} onSave={handleColumnsSave} />
            <Button onClick={() => setShowNew(true)}>+ New Lead</Button>
          </>
        }
      />
      <TerritoryTabsBar />
      <CityFilter />
      {territoryActive && territoryState && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>
            Showing leads in {US_STATES.find(s => s.code === territoryState)?.name || territoryState} only.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => clearTerritoryState('')}>
            Show all
          </Button>
        </div>
      )}

      {showNew && (
        <div className="rounded-lg border border-border bg-surface p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><Label>Name *</Label><Input value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><Label>Email</Label><Input value={newForm.email} onChange={e => setNewForm(p => ({ ...p, email: e.target.value }))} /></div>
          <div><Label>Phone</Label><Input value={newForm.phone} onChange={e => setNewForm(p => ({ ...p, phone: e.target.value }))} /></div>
          <div><Label>Project Type</Label>
            <Select value={newForm.projectTypeId} onChange={e => setNewForm(p => ({ ...p, projectTypeId: e.target.value }))}>
              <option value="">—</option>
              {projectTypes.map((pt: any) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
            </Select>
          </div>
          <div><Label>Value</Label><Input value={newForm.value} onChange={e => setNewForm(p => ({ ...p, value: e.target.value }))} placeholder="$" /></div>
          <div className="sm:col-span-2 lg:col-span-3"><Label>Notes</Label><Textarea value={newForm.notes} onChange={e => setNewForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          <div className="sm:col-span-2 lg:col-span-3">
            <LocationFields value={newForm} onChange={v => setNewForm(p => ({ ...p, ...v }))} />
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <Button onClick={handleCreate}>Save Lead</Button>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {view === 'kanban' && (
        <DndContext sensors={sensors} onDragStart={e => setActiveLead(e.active.data.current as Lead)} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {stages.map(stage => (
              <KanbanColumn key={stage.id} stage={stage} leads={leadsByStage[stage.id] || []} onOpenLead={id => navigate(`/company/leads/${id}`)} />
            ))}
            {unassigned.length > 0 && (
              <div className="min-w-[240px] flex-1 flex flex-col rounded-lg p-2 bg-muted/60">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="text-sm font-semibold">Unassigned</span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{unassigned.length}</span>
                </div>
                {unassigned.map(lead => <LeadCard key={lead.id} lead={lead} onOpen={id => navigate(`/company/leads/${id}`)} />)}
              </div>
            )}
          </div>
          <DragOverlay>{activeLead ? <LeadCard lead={activeLead} compact /> : null}</DragOverlay>
        </DndContext>
      )}

      {view === 'table' && (
        <DataTable
          data={leads}
          columns={tableColumns}
          emptyMessage="No leads yet. Create one above."
          onRowClick={row => navigate(`/company/leads/${row.id}`)}
        />
      )}

      {view === 'kanban' && leads.length === 0 && !showNew && (
        <EmptyState title="No leads in pipeline" description="Add your first lead to get started." action={<Button onClick={() => setShowNew(true)}>+ New Lead</Button>} />
      )}
    </div>
  )
}
