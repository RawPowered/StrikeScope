import { z } from 'zod'
import type { Request, Response, NextFunction } from 'express'

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
      return res.status(400).json({ ok: false, error: `Validation failed: ${errors}` })
    }
    req.body = result.data
    next()
  }
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query)
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
      return res.status(400).json({ ok: false, error: `Validation failed: ${errors}` })
    }
    req.query = result.data as any
    next()
  }
}

export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params)
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
      return res.status(400).json({ ok: false, error: `Validation failed: ${errors}` })
    }
    req.params = result.data as any
    next()
  }
}

export const commonSchemas = {
  uuid: z.string().uuid(),
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(25),
  }),
  companyId: z.string().uuid(),
}

const stateCode = z.string().length(2).regex(/^[A-Z]{2}$/).optional().nullable()
const cityField = z.string().max(100).optional().nullable()
const countyField = z.string().max(100).optional().nullable()
const zipField = z.string().max(20).optional().nullable()
const streetField = z.string().max(500).optional().nullable()
const permitNumber = z.string().max(64).regex(/^[A-Za-z0-9-]*$/).optional().nullable()
const legalDescription = z.string().max(2000).optional().nullable()

export const locationFields = {
  address: streetField,
  city: cityField,
  state: stateCode,
  county: countyField,
  zip: zipField,
}

export const territoryListQuery = {
  state: stateCode,
  city: cityField,
  county: countyField,
}

const territoryMapsSchema = z.object({
  apiKey: z.string().max(256).optional(),
  enableAddressAutocomplete: z.boolean().optional(),
  enableDirections: z.boolean().optional(),
  enableMapEmbed: z.boolean().optional(),
}).optional()

export const territorySchemas = {
  update: z.object({
    enabledStates: z.array(z.string().length(2).regex(/^[A-Z]{2}$/)).default([]),
    splitByState: z.boolean().default(true),
    directoryContactsEnabled: z.boolean().default(true),
    maps: territoryMapsSchema,
  }),
  citiesQuery: z.object({
    state: z.string().length(2).regex(/^[A-Z]{2}$/),
  }),
}

export const geoSchemas = {
  stateQuery: z.object({
    state: z.string().length(2).regex(/^[A-Z]{2}$/),
  }),
  citiesQuery: z.object({
    state: z.string().length(2).regex(/^[A-Z]{2}$/),
    county: z.string().min(1).max(128),
  }),
  cascadeQuery: z.object({
    state: z.string().length(2).regex(/^[A-Z]{2}$/).optional(),
    county: z.string().min(1).max(128).optional(),
    zip: z.string().max(10).optional(),
  }),
  jurisdictionCreate: z.object({
    state: z.string().length(2).regex(/^[A-Z]{2}$/),
    county: z.string().min(1).max(128),
    city: z.string().max(128).optional().nullable(),
    zip: z.string().max(10).optional().nullable(),
    reason: z.string().min(3).max(2000),
  }),
}

export const directoryContactSchemas = {
  create: z.object({
    categoryId: z.string().uuid(),
    name: z.string().min(1).max(255),
    organization: z.string().max(255).optional().nullable(),
    title: z.string().max(255).optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    state: stateCode,
    county: countyField,
    address: streetField,
    notes: z.string().optional().nullable(),
  }),
  update: z.object({
    categoryId: z.string().uuid().optional(),
    name: z.string().min(1).max(255).optional(),
    organization: z.string().max(255).optional().nullable(),
    title: z.string().max(255).optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    state: stateCode,
    county: countyField,
    address: streetField,
    notes: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
  listQuery: z.object({
    categoryId: z.string().uuid().optional(),
    categorySlug: z.string().max(100).optional(),
    state: stateCode,
    county: countyField,
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(25),
  }),
}

export const contactCategorySchemas = {
  create: z.object({
    name: z.string().min(1).max(100),
    sortOrder: z.number().int().default(0),
  }),
  update: z.object({
    name: z.string().min(1).max(100).optional(),
    isEnabled: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
}

export const leadSchemas = {
  create: z.object({
    companyId: z.string().uuid().optional(),
    name: z.string().min(1).max(255),
    email: z.string().email().optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    source: z.string().max(100).optional().nullable(),
    stageId: z.string().uuid().optional().nullable(),
    assignedTo: z.string().max(100).optional().nullable(),
    notes: z.string().optional().nullable(),
    value: z.number().optional().nullable(),
    coSignerName: z.string().max(255).optional().nullable(),
    coSignerEmail: z.string().email().optional().nullable(),
    coSignerPhone: z.string().max(50).optional().nullable(),
    projectTypeId: z.string().uuid().optional().nullable(),
    ...locationFields,
  }),
  update: z.object({
    name: z.string().min(1).max(255).optional(),
    email: z.string().email().optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    source: z.string().max(100).optional().nullable(),
    stageId: z.string().uuid().optional().nullable(),
    assignedTo: z.string().max(100).optional().nullable(),
    notes: z.string().optional().nullable(),
    value: z.number().optional().nullable(),
    coSignerName: z.string().max(255).optional().nullable(),
    coSignerEmail: z.string().email().optional().nullable(),
    coSignerPhone: z.string().max(50).optional().nullable(),
    projectTypeId: z.string().uuid().optional().nullable(),
    dncAt: z.string().datetime().optional().nullable(),
    dncReason: z.string().optional().nullable(),
    ...locationFields,
  }),
  dnc: z.object({
    reason: z.string().max(500).optional(),
  }),
  listQuery: z.object({
    stageId: z.string().uuid().optional(),
    include_custom_fields: z.enum(['true', 'false']).optional(),
    include_dnc: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(25),
    ...territoryListQuery,
  }).passthrough(),
}

export const customerSchemas = {
  create: z.object({
    companyId: z.string().uuid(),
    name: z.string().min(1).max(255),
    email: z.string().email().optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    notes: z.string().optional().nullable(),
    source: z.string().max(50).optional().nullable(),
    sourceLeadId: z.string().uuid().optional().nullable(),
    type: z.string().max(50).optional().nullable(),
    city: cityField,
    state: stateCode,
    county: countyField,
    zip: zipField,
    coSignerContactId: z.string().uuid().optional().nullable(),
  }),
  update: z.object({
    name: z.string().min(1).max(255).optional(),
    email: z.string().email().optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    notes: z.string().optional().nullable(),
    source: z.string().max(50).optional().nullable(),
    type: z.string().max(50).optional().nullable(),
    city: cityField,
    state: stateCode,
    county: countyField,
    zip: zipField,
    coSignerContactId: z.string().uuid().optional().nullable(),
  }),
  listQuery: z.object({
    include_custom_fields: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(25),
    ...territoryListQuery,
  }).passthrough(),
}

export const financingTypeField = z.enum(['cash', 'loan', 'lease', 'co_op', 'other']).optional().nullable()

export const projectSchemas = {
  create: z.object({
    companyId: z.string().uuid(),
    customerId: z.string().uuid(),
    projectTypeId: z.string().uuid().optional().nullable(),
    name: z.string().min(1).max(255),
    address: z.string().max(500).optional().nullable(),
    status: z.enum(['planned', 'active', 'completed', 'cancelled']).default('planned'),
    assignedTo: z.string().max(100).optional().nullable(),
    notes: z.string().optional().nullable(),
    city: cityField,
    state: stateCode,
    county: countyField,
    zip: zipField,
    countyDepartment: z.string().max(500).optional().nullable(),
    permitNumber,
    propertyLegalDescription: legalDescription,
    coSignerContactId: z.string().uuid().optional().nullable(),
    financingType: financingTypeField,
    bankId: z.string().uuid().optional().nullable(),
  }),
  update: z.object({
    customerId: z.string().uuid().optional(),
    projectTypeId: z.string().uuid().optional().nullable(),
    name: z.string().min(1).max(255).optional(),
    address: z.string().max(500).optional().nullable(),
    status: z.enum(['planned', 'active', 'completed', 'cancelled']).optional(),
    assignedTo: z.string().max(100).optional().nullable(),
    notes: z.string().optional().nullable(),
    city: cityField,
    state: stateCode,
    county: countyField,
    zip: zipField,
    countyDepartment: z.string().max(500).optional().nullable(),
    permitNumber,
    propertyLegalDescription: legalDescription,
    coSignerContactId: z.string().uuid().optional().nullable(),
    financingType: financingTypeField,
    bankId: z.string().uuid().optional().nullable(),
  }),
  listQuery: z.object({
    customerId: z.string().uuid().optional(),
    status: z.enum(['planned', 'active', 'completed', 'cancelled']).optional(),
    include_custom_fields: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(25),
    ...territoryListQuery,
  }).passthrough(),
}

export const contactSchemas = {
  create: z.object({
    customerId: z.string().uuid(),
    firstName: z.string().min(1).max(100),
    lastName: z.string().max(100).optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    role: z.string().max(100).optional().nullable(),
    ssnLastFour: z.string().length(4).optional().nullable(),
    dateOfBirth: z.string().date().optional().nullable(),
    isPrimary: z.boolean().default(false),
    notes: z.string().optional().nullable(),
    contactType: z.enum(['standard', 'co_signer', 'primary']).default('standard'),
  }),
  update: z.object({
    customerId: z.string().uuid().optional(),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().max(100).optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    role: z.string().max(100).optional().nullable(),
    ssnLastFour: z.string().length(4).optional().nullable(),
    dateOfBirth: z.string().date().optional().nullable(),
    isPrimary: z.boolean().optional(),
    notes: z.string().optional().nullable(),
    contactType: z.enum(['standard', 'co_signer', 'primary']).optional(),
  }),
  listQuery: z.object({
    customerId: z.string().uuid().optional(),
    include_custom_fields: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(25),
    ...territoryListQuery,
    contactType: z.enum(['standard', 'co_signer', 'primary']).optional(),
  }).passthrough(),
}

export const agreementSchemas = {
  create: z.object({
    companyId: z.string().uuid(),
    customerId: z.string().uuid(),
    projectId: z.string().uuid().optional().nullable(),
    status: z.enum(['draft', 'signed', 'cancelled']).default('draft'),
    terms: z.string().optional().nullable(),
    documentUrl: z.string().url().optional().nullable(),
  }),
  update: z.object({
    status: z.enum(['draft', 'signed', 'cancelled']).optional(),
    terms: z.string().optional().nullable(),
    documentUrl: z.string().url().optional().nullable(),
  }),
  listQuery: z.object({
    status: z.enum(['draft', 'signed', 'cancelled']).optional(),
    customerId: z.string().uuid().optional(),
    include_custom_fields: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(25),
    ...territoryListQuery,
  }).passthrough(),
}

export const userSchemas = {
  create: z.object({
    email: z.string().email(),
    name: z.string().min(1).max(255),
    password: z.string().min(8).max(100),
    role: z.enum(['server_admin', 'company_admin', 'user', 'sales_manager', 'sales_agent', 'project_admin', 'project_manager', 'foreman', 'crewman', 'technician', 'customer']),
    companyId: z.string().uuid().optional().nullable(),
    roleId: z.string().uuid().optional().nullable(),
  }),
  update: z.object({
    email: z.string().email().optional(),
    name: z.string().min(1).max(255).optional(),
    role: z.enum(['server_admin', 'company_admin', 'user', 'sales_manager', 'sales_agent', 'project_admin', 'project_manager', 'foreman', 'crewman', 'technician', 'customer']).optional(),
    roleId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
  listQuery: z.object({
    companyId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(25),
  }).passthrough(),
}

export const stageSchemas = {
  create: z.object({
    name: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#888888'),
  }),
  update: z.object({
    name: z.string().min(1).max(100).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    sortOrder: z.number().int().optional(),
  }),
}

export const customFieldSchemas = {
  create: z.object({
    entity: z.enum(['leads', 'customers', 'contacts', 'agreements', 'projects', 'submissions', 'activities']),
    fieldName: z.string().min(1).max(100),
    label: z.string().min(1).max(255),
    fieldType: z.enum(['text', 'textarea', 'number', 'currency', 'phone', 'email', 'url', 'boolean', 'date', 'select', 'multiselect']),
    optionsJson: z.string().optional().nullable(),
    isRequired: z.boolean().default(false),
    carryOver: z.boolean().default(false),
    sortOrder: z.number().int().default(0),
  }),
  update: z.object({
    label: z.string().min(1).max(255).optional(),
    fieldType: z.enum(['text', 'textarea', 'number', 'currency', 'phone', 'email', 'url', 'boolean', 'date', 'select', 'multiselect']).optional(),
    optionsJson: z.string().optional().nullable(),
    isRequired: z.boolean().optional(),
    carryOver: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
  listQuery: z.object({
    entity: z.enum(['leads', 'customers', 'contacts', 'agreements', 'projects', 'submissions', 'activities']),
  }),
}

export const bankSchemas = {
  create: z.object({
    name: z.string().min(1).max(200),
  }),
  update: z.object({
    name: z.string().min(1).max(200).optional(),
    isActive: z.boolean().optional(),
  }),
}

export const submissionSchemas = {
  listQuery: z.object({
    projectId: z.string().uuid().optional(),
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
    include_custom_fields: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(25),
  }).passthrough(),
}