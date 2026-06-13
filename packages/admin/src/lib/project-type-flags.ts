import type { ProjectType } from '@strikescope/shared/src/types'

export function projectTypeFlags(pt: ProjectType | undefined | null) {
  return {
    isConstruction: !!pt?.isConstruction,
    includeCountyDefaults: !!pt?.includeCountyDefaults,
    requiresPermit: !!pt?.requiresPermit,
    showFinancingFields: !!(pt?.isConstruction || pt?.includeFinancingFields),
  }
}
