import { useEffect, useState, useCallback } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { api } from '../api'
import { asList } from '../lib/list-response'

type SearchRecord = { id: string; label: string; sub?: string; path: string }

export function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [records, setRecords] = useState<SearchRecord[]>([])
  const [loading, setLoading] = useState(false)

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.allSettled([
        api.get('/api/admin/customers?perPage=50'),
        api.get('/api/admin/leads?perPage=50'),
        api.get('/api/admin/contacts?perPage=50'),
        api.get('/api/admin/projects?perPage=50'),
        api.get('/api/admin/agreements?perPage=50'),
        api.get('/api/admin/submissions?perPage=50'),
      ])
      const pick = (i: number) => results[i].status === 'fulfilled' ? results[i].value : { ok: false as const }

      const next: SearchRecord[] = []
      for (const c of asList<any>(pick(0))) {
      next.push({ id: c.id, label: c.name, sub: c.email, path: `/company/customers/${c.id}` })
    }
      for (const l of asList<any>(pick(1))) {
        next.push({ id: l.id, label: l.name, sub: l.email, path: `/company/leads/${l.id}` })
      }
      for (const c of asList<any>(pick(2))) {
        const name = `${c.firstName || ''}${c.lastName ? ` ${c.lastName}` : ''}`.trim()
        next.push({ id: c.id, label: name || 'Contact', sub: c.customerName, path: `/company/contacts/${c.id}` })
      }
      for (const p of asList<any>(pick(3))) {
        next.push({ id: p.id, label: p.name, sub: p.customerName, path: `/company/projects/${p.id}` })
      }
      for (const a of asList<any>(pick(4))) {
        next.push({ id: a.id, label: a.customerName || 'Agreement', sub: a.projectName, path: `/company/agreements/${a.id}` })
      }
      for (const s of asList<any>(pick(5))) {
        next.push({ id: s.id, label: s.projectName || 'Submission', sub: s.installerName, path: `/company/submissions/${s.id}` })
      }
      setRecords(next)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  if (!open) {
    return (
      <button
        type="button"
        className="hidden sm:flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3.5 w-3.5" />
        Search records…
        <kbd className="ml-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-mono">Ctrl K</kbd>
      </button>
    )
  }

  const q = query.toLowerCase()
  const filtered = records.filter(r =>
    r.label?.toLowerCase().includes(q) || r.sub?.toLowerCase().includes(q),
  )

  const go = (path: string) => {
    navigate(path)
    close()
  }

  const groups: { heading: string; items: SearchRecord[] }[] = [
    { heading: 'Customers', items: filtered.filter(r => r.path.includes('/customers/')) },
    { heading: 'Leads', items: filtered.filter(r => r.path.includes('/leads/')) },
    { heading: 'Contacts', items: filtered.filter(r => r.path.includes('/contacts/') && !r.path.includes('/directory/')) },
    { heading: 'Projects', items: filtered.filter(r => r.path.includes('/projects/')) },
    { heading: 'Agreements', items: filtered.filter(r => r.path.includes('/agreements/')) },
    { heading: 'Tasks', items: filtered.filter(r => r.path.includes('/submissions/')) },
  ].filter(g => g.items.length > 0)

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-black/50 p-4 backdrop-blur-sm" onClick={close}>
      <div className="w-full max-w-xl rounded-xl border border-border bg-surface shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <Command shouldFilter={false}>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              placeholder="Search customers, leads, contacts, projects…"
              value={query}
              onValueChange={setQuery}
              className="flex-1 bg-transparent text-sm outline-none py-3"
              autoFocus
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            {loading && <p className="py-6 text-center text-sm text-muted-foreground">Loading records…</p>}
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">No matching records.</Command.Empty>
            <Command.Group heading="Quick nav" className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
              <Command.Item value="nav-leads" onSelect={() => go('/company/leads')} className="cursor-pointer rounded-md px-3 py-2 text-sm aria-selected:bg-muted">Leads pipeline</Command.Item>
              <Command.Item value="nav-customers" onSelect={() => go('/company/customers')} className="cursor-pointer rounded-md px-3 py-2 text-sm aria-selected:bg-muted">Customers</Command.Item>
              <Command.Item value="nav-contacts" onSelect={() => go('/company/contacts')} className="cursor-pointer rounded-md px-3 py-2 text-sm aria-selected:bg-muted">Contacts</Command.Item>
              <Command.Item value="nav-projects" onSelect={() => go('/company/projects')} className="cursor-pointer rounded-md px-3 py-2 text-sm aria-selected:bg-muted">Projects</Command.Item>
              <Command.Item value="nav-dnc" onSelect={() => go('/company/leads/dnc')} className="cursor-pointer rounded-md px-3 py-2 text-sm aria-selected:bg-muted">Do Not Contact</Command.Item>
            </Command.Group>
            {groups.map(g => (
              <Command.Group key={g.heading} heading={g.heading} className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 mt-2">
                {g.items.map(r => (
                  <Command.Item
                    key={`${g.heading}-${r.id}`}
                    value={`${g.heading}-${r.id}`}
                    onSelect={() => go(r.path)}
                    className="cursor-pointer rounded-md px-3 py-2 text-sm aria-selected:bg-muted"
                  >
                    <span className="font-medium">{r.label}</span>
                    {r.sub && <span className="text-muted-foreground ml-2 text-xs">{r.sub}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
