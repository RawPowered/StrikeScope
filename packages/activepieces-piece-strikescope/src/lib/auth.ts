import { PieceAuth, Property } from '@activepieces/pieces-framework'

export const strikescopeAuth = PieceAuth.SecretText({
  displayName: 'Service API Key',
  description: 'Company automation key from StrikeScope Admin → Automations',
  required: true,
})

export const apiUrlProp = Property.ShortText({
  displayName: 'StrikeScope API URL',
  description: 'Base URL reachable from Activepieces (use host.docker.internal on Docker Desktop)',
  required: true,
  defaultValue: 'http://host.docker.internal:3001',
})
