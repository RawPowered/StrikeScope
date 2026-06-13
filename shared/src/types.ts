export type AppKey = 'admin' | 'installer' | 'monitor'

/* ── Branding ── */
export interface BrandingConfig {
  primary: string; secondary: string; accent: string
  grey: string; gunmetal: string; white: string; appName: string
}

/* ── Auth ── */
export type UserRole = 'server_admin' | 'company_admin' | 'user'
  | 'sales_manager' | 'sales_agent' | 'project_admin' | 'project_manager'
  | 'foreman' | 'crewman' | 'technician' | 'customer'

export interface EntityPermission {
  canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean
  fields?: Record<string, { canView: boolean; canEdit: boolean }>
}

export interface User {
  id: string; companyId: string | null; email: string; name: string
  role: UserRole; roleId?: string | null; roleName?: string | null
  membershipId?: string | null
  memberships?: UserMembership[]
  permissions?: Record<string, EntityPermission>
  isActive: boolean; createdAt: string
}

export interface UserMembership {
  id: string
  userId: string
  companyId: string
  companyName: string
  role: UserRole
  roleId: string | null
  roleName: string | null
  isActive: boolean
}

export interface Role {
  id: string; companyId: string; name: string; description: string | null
  isSystem: boolean; createdAt: string; userCount: number
  permissions?: RolePermission[]
}

export interface RolePermission {
  id: string; roleId: string; entity: string
  canView: number; canCreate: number; canEdit: number; canDelete: number
}

export interface RoleFieldPermission {
  id: string; roleId: string; entity: string; field: string
  canView: number; canEdit: number
}

export interface LoginResponse {
  token: string; user: User; permissions?: Record<string, EntityPermission>
}

/* ── Companies (replaces sites) ── */
export interface Company {
  id: string; name: string; address: string | null
  phone: string | null; email: string | null
  brandingJson: string | null; isActive: boolean
  mfaEnabled: boolean
  deletedAt: string | null; createdAt: string
}

export interface DeletedCompany {
  id: string; originalId: string; name: string
  dataJson: string; deletedAt: string
  restoreBy: string; restoredAt: string | null; permanentlyDeletedAt: string | null
}

/* ── Territory ── */
export interface TerritoryMapsConfig {
  apiKey?: string
  enableAddressAutocomplete?: boolean
  enableDirections?: boolean
  enableMapEmbed?: boolean
}

export interface TerritoryConfig {
  enabledStates: string[]
  splitByState: boolean
  directoryContactsEnabled: boolean
  maps?: TerritoryMapsConfig
}

export interface JurisdictionRequest {
  id: string
  companyId: string
  userId: string
  userName?: string
  state: string
  county: string
  city?: string | null
  zip?: string | null
  reason: string
  status: 'pending' | 'approved' | 'denied'
  reviewedBy?: string | null
  reviewedAt?: string | null
  reviewNote?: string | null
  createdAt: string
}

export type ProjectTypeCategory = 'solar' | 'construction' | 'other'
export type FinancingType = 'cash' | 'loan' | 'lease' | 'co_op' | 'other'

/* ── Project Types ── */
export interface ProjectType {
  id: string; name: string; description: string | null
  category?: ProjectTypeCategory
  isConstruction?: boolean
  includeCountyDefaults?: boolean
  requiresPermit?: boolean
  includeFinancingFields?: boolean
  isActive: boolean; createdAt: string
}

export interface CompanyBank {
  id: string; companyId: string; name: string
  isActive: boolean; createdAt: string
}

/* ── Task Templates ── */
/* ── GuideItem alias (backwards compat) ── */
export type GuideItem = TemplateItem

export interface TaskTemplate {
  id: string; companyId: string | null; projectTypeId: string | null
  name: string; description: string | null
  isGlobal: boolean; isDefault: boolean; isPublished: boolean
  sourceTemplateId: string | null; isActive: boolean; createdAt: string
  enableTimeTracking?: boolean
  enableStaleWarnings?: boolean
  slaDaysNotStarted?: number | null
  slaDaysIncomplete?: number | null
  staleDaysIdle?: number | null
  geofenceRadiusM?: number | null
}

export type TimeLogStatus = 'active' | 'completed' | 'lunch_break' | 'material_run'

export interface TimeLog {
  id: string; companyId: string; projectId: string; userId: string
  guestName?: string | null; foremanUserId?: string | null
  sprintId?: string | null
  clockInTime: string; clockOutTime?: string | null
  clockInLat?: number | null; clockInLng?: number | null
  status: TimeLogStatus
}

export interface FieldSession {
  id: string; companyId: string; projectId: string; userId: string
  startedAt: string; endedAt?: string | null
  anchorLat: number; anchorLng: number
  currentActionToken?: string | null
  isActive: boolean
}

export interface StaleProjectSummary {
  isStale: boolean
  kind?: 'not_started' | 'mid_progress_idle' | 'incomplete_sla'
  detail?: string
  since?: string | null
}

export interface ActiveJobSummary {
  id: string; name: string; customerName?: string
  percentComplete: number; completedSteps: number; totalSteps: number
  foremanName?: string | null
  openShifts: { id: string; userName: string; clockInTime: string }[]
  stale: StaleProjectSummary
  lastFieldActivityAt?: string | null
}

export interface TemplateItem {
  id: string; templateId: string
  label: string; sortOrder: number
  titleEn: string; titleEs: string
  descEn: string; descEs: string
  requiredCount: number; exampleImage: string | null
}

/* ── Location fields (shared) ── */
export interface LocationFields {
  address?: string | null
  city?: string | null
  state?: string | null
  county?: string | null
  zip?: string | null
}

/* ── Customers ── */
export interface Customer {
  id: string; companyId: string; name: string
  email: string | null; phone: string | null; address: string | null
  city?: string | null; state?: string | null; county?: string | null; zip?: string | null
  coSignerContactId?: string | null
  notes: string | null
  source: string; sourceLeadId: string | null; type: string
  isActive: boolean; createdAt: string
}

/* ── Projects ── */
export type ProjectStatus = 'planned' | 'active' | 'completed' | 'cancelled'

export interface Project {
  id: string; companyId: string; customerId: string
  projectTypeId: string | null; name: string; address: string | null
  city?: string | null; state?: string | null; county?: string | null; zip?: string | null
  countyDepartment?: string | null
  permitNumber?: string | null
  propertyLegalDescription?: string | null
  coSignerContactId?: string | null
  financingType?: FinancingType | null
  bankId?: string | null
  bankName?: string | null
  status: ProjectStatus; assignedTo: string | null
  accessKey?: string
  notes: string | null; isActive: boolean; createdAt: string
  projectTypeName?: string
  projectTypeIsConstruction?: boolean
  projectTypeIncludeCountyDefaults?: boolean
  projectTypeRequiresPermit?: boolean
  projectTypeIncludeFinancingFields?: boolean
  customerName?: string
}

export interface ProjectTaskItem {
  id: string; projectId: string; templateItemId: string | null
  label: string; sortOrder: number
  titleEn: string; titleEs: string
  descEn: string; descEs: string
  requiredCount: number; exampleImage: string | null
}

/* ── Submissions (updated for projects) ── */
export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface Submission {
  id: string; projectId: string; projectTaskItemId: string | null
  installerId: string | null; installerName: string | null
  gpsLat: number | null; gpsLng: number | null
  capturedAt: string | null; submittedAt: string
  status: SubmissionStatus; photoCount: number
}

export interface SubmissionDetail extends Submission {
  images: SubmissionImage[]
}

export interface SubmissionImage {
  id: string; submissionId: string; projectTaskItemId: string | null
  filename: string; filepath: string
  gpsLat: number | null; gpsLng: number | null; capturedAt: string | null
}

export interface SubmitBody {
  installerName: string; gpsLat: number; gpsLng: number; capturedAt: string
  images: { guideItemId: string; capturedAt: string; gpsLat?: number; gpsLng?: number; data: string }[]
}

/* ── Connections (FK updated to companyId) ── */
export type ConnectionType = 'ssh' | 'ftp' | 'googledrive' | 'dropbox' | 'onedrive' | 'aws-s3'

export interface Connection {
  id: string; companyId: string; type: ConnectionType
  label: string; config: Record<string, string>; isActive: boolean
}

export interface ConnectionInput {
  type: ConnectionType; label: string; config: Record<string, string>; isActive?: boolean
}

/* ── Storage test result ── */
export interface StorageTestResult {
  success: boolean; message: string
}

/* ── Deploy (kept for future use) ── */
export interface DeployRequest {
  hostId: string; app: 'admin' | 'installer' | 'monitor'
}

export interface DeployResult {
  success: boolean; log: string
}

/* ── API response wrapper ── */
export interface ApiResponse<T = unknown> {
  ok: boolean; data?: T; error?: string
}

/* ── CRM: Lead Stages ── */
export interface LeadStage {
  id: string; companyId: string; name: string
  sortOrder: number; color: string; isDefault: boolean
}

/* ── CRM: Leads ── */
export interface Lead {
  id: string; companyId: string; name: string
  email: string | null; phone: string | null; source: string | null
  address?: string | null; city?: string | null; state?: string | null
  county?: string | null; zip?: string | null
  stageId: string | null; assignedTo: string | null
  notes: string | null; value: number | null
  coSignerName: string | null; coSignerEmail: string | null; coSignerPhone: string | null
  convertedAccountId: string | null; convertedProjectId: string | null
  convertedAt: string | null
  projectTypeId: string | null
  dncAt: string | null; dncReason: string | null
  stageName?: string; stageColor?: string
  projectTypeName?: string
  customFieldsJson?: string
  isActive: boolean; createdAt: string
}

/* ── CRM: Contacts ── */
export type ContactType = 'standard' | 'co_signer' | 'primary'

export interface Contact {
  id: string; companyId: string; customerId: string
  firstName: string; lastName: string | null
  email: string | null; phone: string | null; role: string | null
  contactType?: ContactType
  photoIdStorageKey?: string | null
  photoIdMimeType?: string | null
  photoIdUploadedAt?: string | null
  hasPhotoId?: boolean
  ssnLastFour?: string | null; dateOfBirth?: string | null
  isPrimary: boolean; notes: string | null
  customerName?: string
  customerState?: string | null
  customerCity?: string | null
  isActive: boolean; createdAt: string
}

/* ── Directory Contacts ── */
export interface ContactCategory {
  id: string; companyId: string; name: string; slug: string
  isEnabled: boolean; isSystem: boolean; sortOrder: number; createdAt: string
}

export interface DirectoryContact {
  id: string; companyId: string; categoryId: string
  name: string; organization: string | null; title: string | null
  email: string | null; phone: string | null
  state: string | null; county: string | null; address: string | null
  notes: string | null; isActive: boolean; createdAt: string
  categoryName?: string; categorySlug?: string
}

/* ── CRM: Activities (audit trail) ── */
export interface Activity {
  id: string; companyId: string
  entityType: string; entityId: string
  action: string; description: string | null
  userId: string | null; userName: string | null
  performedBy?: string
  performedAt?: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

/* ── Company Domains ── */
export interface CompanyDomain {
  id: string; companyId: string; domain: string
  isPrimary: boolean; isSandbox: boolean; isActive: boolean
}

/* ── Company Maker Deploy ── */
export interface CompanyMakerInput {
  company: { name: string; address?: string; phone?: string; email?: string; branding?: Record<string, string> }
  adminUser: { name: string; email: string; password: string }
  stages: { name: string; color: string }[]
  subdomain: string
}

export interface CompanyMakerResult {
  company: { id: string; name: string }
  user: { id: string; email: string }
  domain: { id: string; domain: string }
}

/* ── CRM: Agreements ── */
export type AgreementStatus = 'draft' | 'signed' | 'cancelled'

export interface Agreement {
  id: string; companyId: string; customerId: string; projectId?: string
  status: AgreementStatus; terms: string; documentUrl?: string
  signedAt?: string; createdAt: string
  customerName?: string; projectName?: string
  customerState?: string | null
  customerCity?: string | null
}

export type CustomerDocumentKind = 'agreement' | 'contract' | 'permit' | 'photo' | 'photo_id' | 'other'

export interface CustomerDocument {
  id: string; companyId: string; customerId: string; projectId?: string | null
  kind: CustomerDocumentKind; agreementId?: string | null; name: string
  storageKey: string; mimeType?: string | null; sizeBytes?: number | null
  uploadedBy?: string | null; createdAt: string
}

/* ── Email Config ── */
export interface CompanyEmailConfig {
  smtpHost: string; smtpPort: number; smtpUser: string; smtpPass?: string
  fromEmail: string; fromName: string
}

/* ── Customer Setup ── */
export interface CustomerSetupToken {
  id: string; email: string; projectId: string; token: string
  expiresAt: string; consumedAt: string | null; createdAt: string
}

export interface CustomerLoginRequest {
  email: string; password: string; accessKey: string
}

/* ── Enabled Role ── */
export interface EnabledRole {
  companyId: string; roleId: string; isEnabled: boolean
  roleName?: string; roleDescription?: string
}

/* ── Custom Fields ── */
export type CustomFieldType = 'text' | 'textarea' | 'number' | 'currency' | 'phone' | 'email' | 'url' | 'boolean' | 'date' | 'select' | 'multiselect'

export type CustomFieldEntity = 'leads' | 'customers' | 'contacts' | 'agreements' | 'projects' | 'submissions' | 'activities'

export interface CustomFieldDefinition {
  id: string; companyId: string; entity: CustomFieldEntity
  fieldName: string; label: string; fieldType: CustomFieldType
  optionsJson?: string; isRequired: boolean; carryOver: boolean
  isEnabled?: boolean; sortOrder: number; createdAt: string
}

export interface BuiltinFieldSetting {
  fieldKey: string; label: string; isBuiltin: boolean; isLocked: boolean; isEnabled: boolean
}

export interface CustomerProperty {
  id: string; companyId: string; customerId: string; label: string | null
  address: string | null; city: string | null; state: string | null; county: string | null; zip: string | null
  isPrimary: boolean; isActive: boolean; createdAt: string
}

export interface ProjectAssignment {
  id?: string; userId: string; role: 'sales_agent' | 'project_manager' | 'sales_manager'; assignedAt?: string
}

export interface ProjectProgress {
  totalSteps: number; completedSteps: number; percentComplete: number
  lastCompleted: { label: string; completedAt: string | null } | null
  currentStep: { label: string; sortOrder: number } | null
  nextStep: { label: string; sortOrder: number } | null
}

export interface CustomFieldValue {
  id: string; entity: CustomFieldEntity; entityId: string
  fieldDefinitionId: string; value: string | null
}

export interface UserColumnPreferences {
  userId: string; entity: CustomFieldEntity; columnsJson: string
}

/* ── Forms ── */
export interface FormDefinition {
  id: string; companyId: string; name: string
  description: string | null
  schemaJson: string
  isActive: boolean; createdAt: string
}

export interface FormSubmission {
  id: string; formId: string; companyId: string
  responseJson: string; createdAt: string
}

export interface FormLink {
  id: string; formId: string; companyId: string
  slug: string; customDomain: string | null
  customPath: string | null; isActive: boolean
}

/* ── WS event types ── */
export type WsEvent =
  | { type: 'new-submission'; data: Submission }
  | { type: 'submission-updated'; data: Submission }
  | { type: 'jurisdiction-pending'; data: { companyId: string; count: number } }
