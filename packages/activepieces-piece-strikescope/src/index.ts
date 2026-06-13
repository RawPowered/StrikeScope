import { createPiece } from '@activepieces/pieces-framework'
import { strikescopeAuth } from './lib/auth'
import {
  leadCreated,
  leadStageChanged,
  customerCreated,
  projectStatusChanged,
} from './triggers/index'
import {
  updateLeadStage,
  assignLeadOwner,
  createLeadNote,
  httpRequest,
} from './actions/index'

export const strikescope = createPiece({
  displayName: 'StrikeScope CRM',
  description: 'Automate leads, customers, and projects in StrikeScope',
  logoUrl: 'https://raw.githubusercontent.com/activepieces/activepieces/main/docs/resources/logo/light.svg',
  authors: ['StrikeScope'],
  auth: strikescopeAuth,
  minimumSupportedRelease: '0.28.0',
  actions: [updateLeadStage, assignLeadOwner, createLeadNote, httpRequest],
  triggers: [leadCreated, leadStageChanged, customerCreated, projectStatusChanged],
})

export default strikescope
