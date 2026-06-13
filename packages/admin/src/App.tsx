import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth, ProtectedRoute } from './auth'
import { AppShell, navIcons } from './layout/AppShell'
import { ConfirmProvider } from './components/ConfirmDialog'
import { AppToaster } from './components/AppToaster'
import QueryProvider from './components/QueryProvider'
import LeadsLayout from './features/leads/LeadsLayout'
import DoNotContact from './features/leads/DoNotContact'
import Customers from './features/customers/Customers'
import CustomerDetail from './features/customers/CustomerDetail'
import AdminLayout from './features/admin/AdminLayout'
import AgreementsList from './features/agreements/AgreementsList'
import AgreementDetail from './features/agreements/AgreementDetail'
import ContactDetail from './features/contacts/ContactDetail'
import DirectoryContactDetail from './features/directory-contacts/DirectoryContactDetail'
import ContactsLayout from './features/contacts/ContactsLayout'
import DirectoryContacts from './features/directory-contacts/DirectoryContacts'
import TerritorySettings from './features/territory/TerritorySettings'
import ContactCategories from './features/directory-contacts/ContactCategories'
import BankNames from './features/financing/BankNames'
import FieldVisibility from './features/field-governance/FieldVisibility'
import AutomationsPage from './features/automations/AutomationsPage'
import FormsList from './features/forms/FormsList'
import FormEditor from './features/forms/FormEditor'
import FormPreview from './features/forms/FormPreview'
import FormLinks from './features/forms/FormLinks'
import FormEmbed from './features/forms/FormEmbed'
import FormSubmissions from './features/forms/FormSubmissions'
import SalesProjectDashboard from './features/sales/SalesProjectDashboard'
import CompanyFinance from './features/finance/CompanyFinance'
import ServerDashboard from './pages/ServerDashboard'
import AdminDashboard from './pages/AdminDashboard'
import CompanyDashboard from './pages/CompanyDashboard'
import Connections from './pages/Connections'
import Branding from './pages/Branding'
import Guide from './pages/Guide'
import Submissions from './pages/Submissions'
import SubmissionDetail from './pages/SubmissionDetail'
import Login from './pages/Login'
import Companies from './pages/Companies'
import Users from './pages/Users'
import ProjectTypes from './pages/ProjectTypes'
import TaskTemplates from './pages/TaskTemplates'
import DeletedItems from './pages/DeletedItems'
import Projects from './pages/Projects'
import LeadStages from './pages/LeadStages'
import ContactList from './pages/ContactList'
import CompanyMaker from './pages/CompanyMaker'
import LeadKanban from './pages/LeadKanban'
import LeadDetail from './pages/LeadDetail'
import DomainSettings from './pages/DomainSettings'
import AuditTrail from './pages/AuditTrail'
import ProjectDetailPage from './pages/ProjectDetail'
import ActiveJobs from './pages/ActiveJobs'
import FieldOps from './pages/FieldOps'
import FieldOverrides from './pages/FieldOverrides'
import JurisdictionRequests from './pages/JurisdictionRequests'
import DevStudioPage from './features/dev-studio/DevStudioPage'
import Roles from './pages/Roles'
import CustomFieldManager from './pages/CustomFieldManager'
import CustomerLogin from './pages/CustomerLogin'
import CustomerSetup from './pages/CustomerSetup'
import CustomerDashboard from './pages/CustomerDashboard'
import VerifyMfa from './pages/VerifyMfa'
import CustomerLayout from './components/CustomerLayout'
import type { NavSection } from './layout/AppShell'

const INSTALLER_URL = import.meta.env.VITE_INSTALLER_URL || 'http://localhost:5174'
const FIELD_URL = import.meta.env.VITE_FIELD_URL || 'http://localhost:5176'
const MONITOR_URL = import.meta.env.VITE_MONITOR_URL || 'http://localhost:5175'

function AuthenticatedApp() {
  const navigate = useNavigate()
  const { user, logout, can, switchCompany } = useAuth()

  const isServerAdmin = user?.role === 'server_admin'
  const isCompanyUser = user?.role === 'company_admin' || user?.role === 'user'
    || ['sales_manager', 'sales_agent', 'project_admin', 'project_manager', 'foreman', 'crewman', 'technician'].includes(user?.role || '')
  const showServerNav = isServerAdmin && !user?.companyId
  const showCompanyNav = isCompanyUser || (isServerAdmin && !!user?.companyId)

  const handleWorkspaceSwitch = async (id: string | null) => {
    const err = await switchCompany(id)
    if (!err) navigate(id ? '/company/dashboard' : '/server/dashboard', { replace: true })
  }

  const serverSections: NavSection[] = [
    { items: [{ label: 'Dashboard', to: '/server/dashboard', icon: navIcons.dashboard, end: true }] },
    {
      label: 'System',
      items: [
        { label: 'Companies', to: '/server/companies', icon: navIcons.companies },
        { label: 'Users', to: '/server/users', icon: navIcons.users },
        { label: 'Project Types', to: '/server/project-types', icon: navIcons.projects },
        { label: 'Task Templates', to: '/server/task-templates', icon: navIcons.tasks },
        { label: 'Deleted Items', to: '/server/deleted-items', icon: navIcons.trash },
        { label: 'Dev Studio', to: '/server/dev-studio', icon: navIcons.code },
      ],
    },
    {
      label: 'Infrastructure',
      items: [
        { label: 'Domains', to: '/server/domains', icon: navIcons.globe },
        { label: '+ New Company', to: '/server/company-maker', icon: navIcons.plus },
      ],
    },
  ]

  const companySections: NavSection[] = [
    { items: [{ label: 'Dashboard', to: '/company/dashboard', icon: navIcons.dashboard, end: true }] },
    {
      items: [
        ...(can('leads') ? [{ label: 'Leads', to: '/company/leads', icon: navIcons.leads, end: true }] : []),
        ...(can('contacts') ? [{ label: 'Contacts', to: '/company/contacts', icon: navIcons.contacts }] : []),
        ...(can('customers') ? [{ label: 'Customers', to: '/company/customers', icon: navIcons.customers }] : []),
        ...(can('projects') ? [
          { label: 'Projects', to: '/company/projects', icon: navIcons.projects },
          { label: 'Active Jobs', to: '/company/jobs/active', icon: navIcons.tasks },
        ] : []),
        ...(user?.roleName === 'Sales Agent' ? [{ label: 'My Projects', to: '/company/sales-projects', icon: navIcons.projects }] : []),
        ...(can('agreements') ? [{ label: 'Agreements', to: '/company/agreements', icon: navIcons.customers }] : []),
        ...(can('forms') ? [{ label: 'Forms', to: '/company/forms', icon: navIcons.fileText }] : []),
        { label: 'Tasks', to: '/company/submissions', icon: navIcons.tasks },
      ],
    },
    {
      label: 'Admin',
      items: [{ label: 'Admin Panel', to: '/company/admin/dashboard', icon: navIcons.admin }],
    },
  ]

  const footerLinks = [
    { label: 'Field App', href: FIELD_URL },
    { label: 'Installer App', href: INSTALLER_URL },
    { label: 'Monitor App', href: MONITOR_URL },
  ]

  const workspaceName = user?.memberships?.find(m => m.companyId === user?.companyId)?.companyName

  return (
    <AppShell
      mode={showServerNav ? 'server' : 'company'}
      sections={showServerNav ? serverSections : companySections}
      footerLinks={footerLinks}
      userName={user?.name}
      workspaceName={workspaceName}
      showWorkspaceBanner={isServerAdmin && !!user?.companyId}
      onExitWorkspace={() => handleWorkspaceSwitch(null)}
      memberships={isServerAdmin ? user?.memberships : undefined}
      activeCompanyId={user?.companyId}
      onWorkspaceSelect={id => handleWorkspaceSwitch(id)}
      onLogout={logout}
    >
      <Routes>
        {showServerNav && (
          <>
            <Route path="/server" element={<Navigate to="/server/dashboard" replace />} />
            <Route path="/server/dashboard" element={<ProtectedRoute><ServerDashboard /></ProtectedRoute>} />
            <Route path="/server/companies" element={<ProtectedRoute roles={['server_admin']}><Companies /></ProtectedRoute>} />
            <Route path="/server/users" element={<ProtectedRoute roles={['server_admin', 'company_admin']}><Users /></ProtectedRoute>} />
            <Route path="/server/project-types" element={<ProtectedRoute roles={['server_admin']}><ProjectTypes /></ProtectedRoute>} />
            <Route path="/server/task-templates" element={<ProtectedRoute roles={['server_admin']}><TaskTemplates /></ProtectedRoute>} />
            <Route path="/server/deleted-items" element={<ProtectedRoute roles={['server_admin']}><DeletedItems /></ProtectedRoute>} />
            <Route path="/server/domains" element={<ProtectedRoute roles={['server_admin']}><DomainSettings /></ProtectedRoute>} />
            <Route path="/server/company-maker" element={<ProtectedRoute roles={['server_admin']}><CompanyMaker /></ProtectedRoute>} />
            <Route path="/server/dev-studio" element={<ProtectedRoute roles={['server_admin']}><DevStudioPage /></ProtectedRoute>} />
          </>
        )}
        {showCompanyNav && (
          <>
            <Route path="/company" element={<Navigate to="/company/dashboard" replace />} />
            <Route path="/company/dashboard" element={<ProtectedRoute><CompanyDashboard /></ProtectedRoute>} />

            <Route path="/company/leads" element={<ProtectedRoute requirePermission={{ entity: 'leads', action: 'view' }}><LeadsLayout /></ProtectedRoute>}>
              <Route index element={<LeadKanban />} />
              <Route path="dnc" element={<DoNotContact />} />
              <Route path=":id" element={<LeadDetail />} />
            </Route>

            <Route path="/company/contacts" element={<ProtectedRoute requirePermission={{ entity: 'contacts', action: 'view' }}><ContactsLayout /></ProtectedRoute>}>
              <Route index element={<ContactList />} />
              <Route path="directory" element={<DirectoryContacts />} />
              <Route path="directory/:categorySlug" element={<DirectoryContacts />} />
              <Route path="directory/:categorySlug/:id" element={<DirectoryContactDetail />} />
              <Route path=":id" element={<ContactDetail />} />
            </Route>
            <Route path="/company/customers" element={<ProtectedRoute requirePermission={{ entity: 'customers', action: 'view' }}><Customers /></ProtectedRoute>} />
            <Route path="/company/customers/:id" element={<ProtectedRoute requirePermission={{ entity: 'customers', action: 'view' }}><CustomerDetail /></ProtectedRoute>} />

            <Route path="/company/agreements" element={<ProtectedRoute requirePermission={{ entity: 'agreements', action: 'view' }}><AgreementsList /></ProtectedRoute>} />
            <Route path="/company/agreements/:id" element={<ProtectedRoute requirePermission={{ entity: 'agreements', action: 'view' }}><AgreementDetail /></ProtectedRoute>} />

            <Route path="/company/projects" element={<ProtectedRoute requirePermission={{ entity: 'projects', action: 'view' }}><Projects /></ProtectedRoute>} />
            <Route path="/company/projects/:id" element={<ProtectedRoute requirePermission={{ entity: 'projects', action: 'view' }}><ProjectDetailPage /></ProtectedRoute>} />
            <Route path="/company/jobs/active" element={<ProtectedRoute requirePermission={{ entity: 'projects', action: 'view' }}><ActiveJobs /></ProtectedRoute>} />
            <Route path="/company/sales-projects" element={<ProtectedRoute requirePermission={{ entity: 'projects', action: 'view' }}><SalesProjectDashboard /></ProtectedRoute>} />
            <Route path="/company/forms" element={<ProtectedRoute requirePermission={{ entity: 'forms', action: 'view' }}><FormsList /></ProtectedRoute>} />
            <Route path="/company/forms/new" element={<ProtectedRoute requirePermission={{ entity: 'forms', action: 'create' }}><FormEditor /></ProtectedRoute>} />
            <Route path="/company/forms/:id/edit" element={<ProtectedRoute requirePermission={{ entity: 'forms', action: 'edit' }}><FormEditor /></ProtectedRoute>} />
            <Route path="/company/forms/:id/preview" element={<ProtectedRoute requirePermission={{ entity: 'forms', action: 'view' }}><FormPreview /></ProtectedRoute>} />
            <Route path="/company/forms/:id/links" element={<ProtectedRoute requirePermission={{ entity: 'forms', action: 'edit' }}><FormLinks /></ProtectedRoute>} />
            <Route path="/company/forms/:id/embed" element={<ProtectedRoute requirePermission={{ entity: 'forms', action: 'view' }}><FormEmbed /></ProtectedRoute>} />
            <Route path="/company/forms/:id/submissions" element={<ProtectedRoute requirePermission={{ entity: 'forms', action: 'view' }}><FormSubmissions /></ProtectedRoute>} />
            <Route path="/company/finance" element={<ProtectedRoute roles={['server_admin', 'company_admin']}><CompanyFinance /></ProtectedRoute>} />
            <Route path="/company/submissions" element={<ProtectedRoute><Submissions /></ProtectedRoute>} />
            <Route path="/company/submissions/:id" element={<ProtectedRoute><SubmissionDetail /></ProtectedRoute>} />

            <Route path="/company/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="lead-stages" element={<ProtectedRoute roles={['server_admin', 'company_admin']}><LeadStages /></ProtectedRoute>} />
              <Route path="users" element={<ProtectedRoute roles={['server_admin', 'company_admin']}><Users /></ProtectedRoute>} />
              <Route path="roles" element={<ProtectedRoute roles={['server_admin', 'company_admin']}><Roles /></ProtectedRoute>} />
              <Route path="custom-fields" element={<ProtectedRoute roles={['server_admin', 'company_admin']}><CustomFieldManager /></ProtectedRoute>} />
              <Route path="field-visibility" element={<ProtectedRoute roles={['server_admin', 'company_admin']}><FieldVisibility /></ProtectedRoute>} />
              <Route path="audit" element={<ProtectedRoute roles={['server_admin', 'company_admin']}><AuditTrail /></ProtectedRoute>} />
              <Route path="branding" element={<ProtectedRoute><Branding /></ProtectedRoute>} />
              <Route path="connections" element={<ProtectedRoute><Connections /></ProtectedRoute>} />
              <Route path="forms" element={<ProtectedRoute roles={['server_admin', 'company_admin']}><FormsList /></ProtectedRoute>} />
              <Route path="automations" element={<ProtectedRoute roles={['server_admin', 'company_admin']}><AutomationsPage /></ProtectedRoute>} />
              <Route path="guide" element={<ProtectedRoute><Guide /></ProtectedRoute>} />
              <Route path="territory" element={<ProtectedRoute roles={['server_admin', 'company_admin']}><TerritorySettings /></ProtectedRoute>} />
              <Route path="contact-categories" element={<ProtectedRoute roles={['server_admin', 'company_admin']}><ContactCategories /></ProtectedRoute>} />
              <Route path="banks" element={<ProtectedRoute roles={['server_admin', 'company_admin']}><BankNames /></ProtectedRoute>} />
              <Route path="field-ops" element={<ProtectedRoute roles={['server_admin', 'company_admin', 'project_admin', 'project_manager']}><FieldOps /></ProtectedRoute>} />
              <Route path="field-overrides" element={<ProtectedRoute roles={['server_admin', 'company_admin', 'project_admin']}><FieldOverrides /></ProtectedRoute>} />
              <Route path="jurisdiction-requests" element={<ProtectedRoute roles={['server_admin', 'company_admin', 'project_admin']}><JurisdictionRequests /></ProtectedRoute>} />
            </Route>
          </>
        )}

        <Route path="/customer" element={<CustomerLayout />}>
          <Route path="login" element={<CustomerLogin />} />
          <Route path="setup" element={<CustomerSetup />} />
          <Route path="dashboard" element={<CustomerDashboard />} />
        </Route>
        <Route path="/verify-mfa" element={<VerifyMfa />} />

        <Route path="/" element={<Navigate to={showServerNav ? '/server/dashboard' : '/company/dashboard'} replace />} />
        <Route path="*" element={<Navigate to={showServerNav ? '/server/dashboard' : '/company/dashboard'} replace />} />
      </Routes>
    </AppShell>
  )
}

export default function App() {
  const { user } = useAuth()
  const hasMfaToken = !!localStorage.getItem('mfa_token')
  const path = window.location.pathname
  const isPublicPath = path.startsWith('/customer/') || path === '/verify-mfa'
  const isLoggedIn = !!user

  if (isPublicPath) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/customer" element={<CustomerLayout />}>
            <Route path="login" element={<CustomerLogin />} />
            <Route path="setup" element={<CustomerSetup />} />
            <Route path="dashboard" element={<CustomerDashboard />} />
          </Route>
          <Route path="/verify-mfa" element={<VerifyMfa />} />
          <Route path="*" element={<Navigate to="/customer/login" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      {!isLoggedIn && !hasMfaToken ? (
        <Login />
      ) : !isLoggedIn && hasMfaToken ? (
        <VerifyMfa />
      ) : (
        <QueryProvider>
          <ConfirmProvider>
            <AppToaster />
            <AuthenticatedApp />
          </ConfirmProvider>
        </QueryProvider>
      )}
    </BrowserRouter>
  )
}
