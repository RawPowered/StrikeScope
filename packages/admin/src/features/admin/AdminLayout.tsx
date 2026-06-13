import { Outlet } from 'react-router-dom'
import { SectionTabs } from '../../layout/SectionTabs'

const subLinks = [
  { label: 'Dashboard', path: '/company/admin/dashboard', end: true },
  { label: 'Pipeline Stages', path: '/company/admin/lead-stages' },
  { label: 'Users', path: '/company/admin/users' },
  { label: 'Roles', path: '/company/admin/roles' },
  { label: 'Module Control', path: '/company/admin/custom-fields' },
  { label: 'Field Visibility', path: '/company/admin/field-visibility' },
  { label: 'Audit Trail', path: '/company/admin/audit' },
  { label: 'Branding', path: '/company/admin/branding' },
  { label: 'Connections', path: '/company/admin/connections' },
  { label: 'Automations', path: '/company/admin/automations' },
  { label: 'Photo Guide', path: '/company/admin/guide' },
  { label: 'Territory', path: '/company/admin/territory' },
  { label: 'Jurisdiction Requests', path: '/company/admin/jurisdiction-requests' },
  { label: 'Contact Categories', path: '/company/admin/contact-categories' },
  { label: 'Bank Names', path: '/company/admin/banks' },
  { label: 'Field Ops', path: '/company/admin/field-ops' },
  { label: 'Field Overrides', path: '/company/admin/field-overrides' },
  { label: 'Company Finance', path: '/company/finance' },
]

export default function AdminLayout() {
  return (
    <div>
      <SectionTabs tabs={subLinks} />
      <Outlet />
    </div>
  )
}
