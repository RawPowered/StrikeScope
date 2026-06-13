import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2, FolderKanban, ClipboardList, Trash2,
  Globe, Plus, Contact, UserCircle, FolderOpen, Camera, Settings, ChevronLeft, Code2, FileText,
  ChevronRight, LogOut, ExternalLink,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import { CommandPalette } from '../components/CommandPalette'
import type { UserMembership } from '@strikescope/shared/src/types'

function CommandPaletteSlot() {
  return <CommandPalette />
}

export interface NavItem {
  label: string
  to: string
  icon?: ReactNode
  end?: boolean
  badge?: number
}

export interface NavSection {
  label?: string
  items: NavItem[]
}

const iconClass = 'h-4 w-4 shrink-0'

function CompanySelector({ memberships, activeCompanyId, onSelect, showServerAdmin }: {
  memberships: UserMembership[]
  activeCompanyId: string | null | undefined
  onSelect: (id: string | null) => void
  showServerAdmin?: boolean
}) {
  const [open, setOpen] = useState(false)
  const active = memberships.find(m => m.companyId === activeCompanyId)

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-sidebar-foreground/70 border border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground"
        onClick={() => setOpen(!open)}
      >
        {active?.companyName || 'Enter Workspace'}
      </Button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-y-auto rounded-md border border-border bg-surface text-foreground shadow-lg z-50">
          {showServerAdmin && (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm font-medium text-violet-700 hover:bg-muted border-b border-border"
              onClick={() => { setOpen(false); onSelect(null) }}
            >
              Server Admin
            </button>
          )}
          {memberships.map(m => (
            <button
              key={m.companyId}
              type="button"
              className={cn(
                'block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted border-b border-border last:border-0',
                m.companyId === activeCompanyId && 'bg-muted font-medium',
              )}
              onClick={() => { setOpen(false); onSelect(m.companyId) }}
            >
              {m.companyName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AppShell({
  mode,
  sections,
  footerLinks,
  userName,
  workspaceName,
  showWorkspaceBanner,
  onExitWorkspace,
  memberships,
  activeCompanyId,
  onWorkspaceSelect,
  onLogout,
  children,
}: {
  mode: 'server' | 'company'
  sections: NavSection[]
  footerLinks?: { label: string; href: string }[]
  userName?: string
  workspaceName?: string
  showWorkspaceBanner?: boolean
  onExitWorkspace?: () => void
  memberships?: UserMembership[]
  activeCompanyId?: string | null
  onWorkspaceSelect?: (id: string | null) => void
  onLogout: () => void
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          'flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200',
          collapsed ? 'w-16' : 'w-56',
          mode === 'server' ? 'border-t-[3px] border-t-violet-500' : 'border-t-[3px] border-t-primary',
        )}
      >
        <div className={cn('flex items-center gap-2 px-4 py-4 border-b border-sidebar-border', collapsed && 'justify-center px-2')}>
          <span className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded text-xs font-bold text-white',
            mode === 'server' ? 'bg-violet-500' : 'bg-primary',
          )}>
            {mode === 'server' ? 'S' : 'C'}
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">StrikeScope</div>
              <div className={cn('text-[10px] uppercase tracking-wider font-semibold', mode === 'server' ? 'text-violet-400' : 'text-primary/70')}>
                {mode === 'server' ? 'Server Admin' : 'Company Platform'}
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {sections.map((section, si) => (
            <div key={si}>
              {section.label && !collapsed && (
                <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
                  {section.label}
                </div>
              )}
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                    collapsed && 'justify-center px-2',
                    isActive ? 'bg-sidebar-accent text-sidebar-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                  )}
                >
                  {item.icon}
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-xs text-red-300">{item.badge}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-2">
          {footerLinks?.map(link => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground px-1',
                collapsed && 'justify-center',
              )}
            >
              <ExternalLink className={iconClass} />
              {!collapsed && link.label}
            </a>
          ))}
          {memberships && onWorkspaceSelect && !collapsed && (
            <CompanySelector
              memberships={memberships}
              activeCompanyId={activeCompanyId}
              onSelect={onWorkspaceSelect}
              showServerAdmin={mode === 'company'}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn('w-full text-sidebar-foreground/60 hover:text-sidebar-foreground', collapsed && 'px-0')}
            onClick={onLogout}
          >
            <LogOut className={iconClass} />
            {!collapsed && 'Sign Out'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-full text-sidebar-foreground/40"
            onClick={() => setCollapsed(c => !c)}
          >
            {collapsed ? <ChevronRight className={iconClass} /> : <ChevronLeft className={iconClass} />}
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        {showWorkspaceBanner && workspaceName && (
          <div className="flex items-center justify-between gap-4 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-900">
            <span>Workspace: <strong>{workspaceName}</strong></span>
            {onExitWorkspace && (
              <Button variant="outline" size="sm" onClick={onExitWorkspace}>Exit workspace</Button>
            )}
          </div>
        )}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
          <div className="text-sm text-muted-foreground truncate">
            {userName && <span>Signed in as <strong className="text-foreground">{userName}</strong></span>}
          </div>
          <CommandPaletteSlot />
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}

export const navIcons = {
  dashboard: <LayoutDashboard className={iconClass} />,
  leads: <FolderKanban className={iconClass} />,
  contacts: <Contact className={iconClass} />,
  customers: <UserCircle className={iconClass} />,
  projects: <FolderOpen className={iconClass} />,
  tasks: <ClipboardList className={iconClass} />,
  admin: <Settings className={iconClass} />,
  companies: <Building2 className={iconClass} />,
  users: <Users className={iconClass} />,
  trash: <Trash2 className={iconClass} />,
  globe: <Globe className={iconClass} />,
  plus: <Plus className={iconClass} />,
  camera: <Camera className={iconClass} />,
  code: <Code2 className={iconClass} />,
  fileText: <FileText className={iconClass} />,
}
