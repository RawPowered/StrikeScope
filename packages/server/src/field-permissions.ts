export interface SensitiveFieldDef {
  field: string
  label: string
  description: string
  category: string
}

const SENSITIVE_FIELDS_CONFIG: Record<string, SensitiveFieldDef[]> = {
  leads: [
    { field: 'co_signer_name',  label: 'Co-Signer Name',  description: 'Full name of the co-signer on the contract',          category: 'Co-Signer Information' },
    { field: 'co_signer_email', label: 'Co-Signer Email', description: 'Email address of the co-signer',                      category: 'Co-Signer Information' },
    { field: 'co_signer_phone', label: 'Co-Signer Phone', description: 'Phone number of the co-signer',                       category: 'Co-Signer Information' },
  ],
  contacts: [
    { field: 'ssn_last_four',   label: 'SSN (Last 4)',    description: 'Last four digits of Social Security Number',         category: 'Personally Identifiable Information (PII)' },
    { field: 'date_of_birth',   label: 'Date of Birth',   description: 'Date of birth for credit and identity verification',  category: 'Personally Identifiable Information (PII)' },
  ],
}

export function getSensitiveFields(): Record<string, SensitiveFieldDef[]> {
  return SENSITIVE_FIELDS_CONFIG
}

export function isSensitiveField(entity: string, field: string): boolean {
  return SENSITIVE_FIELDS_CONFIG[entity]?.some(f => f.field === field) ?? false
}

export function getAllSensitiveFieldPairs(): { entity: string; field: string }[] {
  const pairs: { entity: string; field: string }[] = []
  for (const [entity, fields] of Object.entries(SENSITIVE_FIELDS_CONFIG)) {
    for (const f of fields) {
      pairs.push({ entity, field: f.field })
    }
  }
  return pairs
}
