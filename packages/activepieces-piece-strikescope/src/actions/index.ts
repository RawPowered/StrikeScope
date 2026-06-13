import { createAction, Property } from '@activepieces/pieces-framework'
import { HttpMethod } from '@activepieces/pieces-common'
import { strikescopeAuth, apiUrlProp } from '../lib/auth'
import { strikeScopeRequest } from '../lib/api'
import { authSecret } from '../lib/auth-value'

export const updateLeadStage = createAction({
  auth: strikescopeAuth,
  name: 'update_lead_stage',
  displayName: 'Update Lead Stage',
  description: 'Move a lead to a different pipeline stage',
  props: {
    apiUrl: apiUrlProp,
    leadId: Property.ShortText({ displayName: 'Lead ID', required: true }),
    stageId: Property.ShortText({ displayName: 'Stage ID', required: true }),
  },
  async run(context) {
    const apiUrl = context.propsValue.apiUrl as string
    const serviceKey = authSecret(context.auth)
    const leadId = context.propsValue.leadId as string
    const stageId = context.propsValue.stageId as string
    return strikeScopeRequest(apiUrl, serviceKey, `/api/admin/automations/service/leads/${leadId}/stage`, HttpMethod.POST, { stageId })
  },
})

export const assignLeadOwner = createAction({
  auth: strikescopeAuth,
  name: 'assign_lead_owner',
  displayName: 'Assign Lead Owner',
  description: 'Assign a user as the lead owner',
  props: {
    apiUrl: apiUrlProp,
    leadId: Property.ShortText({ displayName: 'Lead ID', required: true }),
    ownerId: Property.ShortText({ displayName: 'Owner User ID', required: true }),
  },
  async run(context) {
    const apiUrl = context.propsValue.apiUrl as string
    const serviceKey = authSecret(context.auth)
    const leadId = context.propsValue.leadId as string
    const ownerId = context.propsValue.ownerId as string
    return strikeScopeRequest(apiUrl, serviceKey, `/api/admin/automations/service/leads/${leadId}/assign`, HttpMethod.POST, { ownerId })
  },
})

export const createLeadNote = createAction({
  auth: strikescopeAuth,
  name: 'create_lead_note',
  displayName: 'Create Lead Note',
  description: 'Add an activity note to a lead',
  props: {
    apiUrl: apiUrlProp,
    leadId: Property.ShortText({ displayName: 'Lead ID', required: true }),
    note: Property.LongText({ displayName: 'Note', required: true }),
  },
  async run(context) {
    const apiUrl = context.propsValue.apiUrl as string
    const serviceKey = authSecret(context.auth)
    const leadId = context.propsValue.leadId as string
    const note = context.propsValue.note as string
    return strikeScopeRequest(apiUrl, serviceKey, `/api/admin/automations/service/leads/${leadId}/note`, HttpMethod.POST, { note })
  },
})

export const httpRequest = createAction({
  auth: strikescopeAuth,
  name: 'http_request',
  displayName: 'HTTP Request',
  description: 'Send an HTTP request through StrikeScope (server-side proxy)',
  props: {
    apiUrl: apiUrlProp,
    method: Property.StaticDropdown({
      displayName: 'Method',
      required: true,
      options: {
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'PATCH', value: 'PATCH' },
          { label: 'DELETE', value: 'DELETE' },
        ],
      },
    }),
    url: Property.ShortText({ displayName: 'URL', required: true }),
    body: Property.Json({ displayName: 'Body', required: false }),
  },
  async run(context) {
    const apiUrl = context.propsValue.apiUrl as string
    const serviceKey = authSecret(context.auth)
    return strikeScopeRequest(apiUrl, serviceKey, '/api/admin/automations/service/http-request', HttpMethod.POST, {
      method: context.propsValue.method,
      url: context.propsValue.url,
      body: context.propsValue.body,
    })
  },
})
